'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  epley1RM,
  generateWorkout,
  nextFocus,
  restSeconds,
  GenerateOptions,
  Focus,
  Goal,
  HistorySession,
  Muscle,
  PlannedExercise,
  PlannedWorkout,
} from './ai-engine';
import { syncBodyWeight, syncSession } from './sync';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActiveSet {
  id: string;
  targetWeight: number;
  targetReps: number;
  weight: number;
  reps: number;
  rir: number | null;
  done: boolean;
  isPR: boolean;
}

export interface ActiveExercise extends Omit<PlannedExercise, 'sets'> {
  sets: ActiveSet[];
}

export interface ActiveWorkout {
  id: string;
  name: string;
  focus: Focus;
  goal: Goal;
  startedAt: number;
  exercises: ActiveExercise[];
}

export interface Prefs {
  name: string;
  goal: Goal;
  duration: number;
  weightKg: number;
}

export interface BodyMetric {
  date: string; // YYYY-MM-DD
  weightKg: number;
}

export interface FinishSummary {
  session: HistorySession;
  prs: { name: string; e1rm: number; previous: number }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Meilleur 1RM théorique jamais réalisé sur un exercice. */
export function bestE1RM(history: HistorySession[], slug: string): number {
  let best = 0;
  for (const s of history) {
    for (const e of s.exercises) {
      if (e.slug !== slug) continue;
      for (const set of e.sets) best = Math.max(best, epley1RM(set.weight, set.reps, set.rir));
    }
  }
  return best;
}

/** Dernière performance enregistrée pour un exercice (séance la plus récente d'abord). */
export function lastPerformance(history: HistorySession[], slug: string) {
  for (const s of history) {
    const e = s.exercises.find((x) => x.slug === slug);
    if (e) return { date: s.date, sets: e.sets };
  }
  return null;
}

export function buildSummary(active: ActiveWorkout, history: HistorySession[]): FinishSummary {
  const exercises: HistorySession['exercises'] = [];
  const prs: FinishSummary['prs'] = [];
  let volume = 0;
  let totalSets = 0;

  for (const ex of active.exercises) {
    const done = ex.sets.filter((s) => s.done);
    if (done.length === 0) continue;
    const logged = done.map((s) => ({ weight: s.weight, reps: s.reps, rir: s.rir ?? 2 }));
    exercises.push({ slug: ex.slug, name: ex.name, muscle: ex.muscle as Muscle, sets: logged });
    totalSets += logged.length;
    volume += logged.reduce((acc, s) => acc + s.weight * s.reps, 0);

    const best = Math.max(...logged.map((s) => epley1RM(s.weight, s.reps, s.rir)));
    const previous = bestE1RM(history, ex.slug);
    if (previous > 0 && best > previous + 0.01) prs.push({ name: ex.name, e1rm: best, previous });
  }

  const session: HistorySession = {
    id: active.id,
    name: active.name,
    date: new Date().toISOString(),
    durationMin: Math.max(1, Math.round((Date.now() - active.startedAt) / 60000)),
    volume: Math.round(volume),
    sets: totalSets,
    prs: prs.length,
    focus: active.focus,
    goal: active.goal,
    exercises,
  };
  return { session, prs };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface State {
  history: HistorySession[]; // plus récente en premier
  bodyMetrics: BodyMetric[];
  prefs: Prefs;
  active: ActiveWorkout | null;
  restEndsAt: number | null;
  restTotal: number;
  restLabel: string;

  setPrefs: (p: Partial<Prefs>) => void;
  planWorkout: (opts?: Partial<GenerateOptions>) => PlannedWorkout;
  startWorkout: (plan: PlannedWorkout) => void;
  updateSet: (ei: number, si: number, patch: Partial<Pick<ActiveSet, 'weight' | 'reps' | 'rir'>>) => void;
  toggleSet: (ei: number, si: number) => void;
  addSet: (ei: number) => void;
  removeSet: (ei: number, si: number) => void;
  startRest: (seconds: number, label: string) => void;
  adjustRest: (deltaSeconds: number) => void;
  stopRest: () => void;
  finishWorkout: () => FinishSummary | null;
  cancelWorkout: () => void;
  addBodyWeight: (weightKg: number, date?: string) => void;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      history: [],
      bodyMetrics: [],
      prefs: { name: '', goal: 'masse', duration: 45, weightKg: 75 },
      active: null,
      restEndsAt: null,
      restTotal: 0,
      restLabel: '',

      setPrefs: (p) => set((s) => ({ prefs: { ...s.prefs, ...p } })),

      planWorkout: (opts = {}) => {
        const { history, prefs, bodyMetrics } = get();
        const latest = [...bodyMetrics].sort((a, b) => b.date.localeCompare(a.date))[0];
        return generateWorkout({
          focus: opts.focus ?? nextFocus(history[0]?.focus),
          duration: opts.duration ?? prefs.duration,
          goal: opts.goal ?? prefs.goal,
          history,
          bodyWeightKg: latest?.weightKg ?? prefs.weightKg,
          seed: opts.seed,
        });
      },

      startWorkout: (plan) => {
        const exercises: ActiveExercise[] = plan.exercises.map((e) => ({
          ...e,
          sets: e.sets.map((s) => ({
            id: uid(),
            targetWeight: s.weight,
            targetReps: s.reps,
            weight: s.weight,
            reps: s.reps,
            rir: null,
            done: false,
            isPR: false,
          })),
        }));
        set({
          active: {
            id: uid(),
            name: plan.name,
            focus: plan.focus,
            goal: plan.goal,
            startedAt: Date.now(),
            exercises,
          },
          restEndsAt: null,
        });
      },

      updateSet: (ei, si, patch) => {
        const { active } = get();
        if (!active) return;
        set({
          active: {
            ...active,
            exercises: active.exercises.map((ex, i) =>
              i !== ei ? ex : { ...ex, sets: ex.sets.map((s, j) => (j !== si ? s : { ...s, ...patch })) }
            ),
          },
        });
      },

      toggleSet: (ei, si) => {
        const { active, history } = get();
        if (!active) return;
        const exercise = active.exercises[ei];
        const target = exercise?.sets[si];
        if (!exercise || !target) return;

        const becomingDone = !target.done;
        const rir = target.rir ?? 2;
        let isPR = false;

        if (becomingDone) {
          const previous = bestE1RM(history, exercise.slug);
          const inSession = Math.max(
            0,
            ...exercise.sets
              .filter((x, i) => i !== si && x.done)
              .map((x) => epley1RM(x.weight, x.reps, x.rir ?? 2))
          );
          const current = epley1RM(target.weight, target.reps, rir);
          isPR = previous > 0 && current > Math.max(previous, inSession) + 0.01;
        }

        const exercises = active.exercises.map((ex, i) =>
          i !== ei
            ? ex
            : {
                ...ex,
                sets: ex.sets.map((s, j) =>
                  j !== si ? s : { ...s, done: becomingDone, rir: becomingDone ? rir : s.rir, isPR }
                ),
              }
        );
        set({ active: { ...active, exercises } });

        if (becomingDone) {
          const allDone = exercises.every((ex) => ex.sets.every((s) => s.done));
          if (!allDone) get().startRest(restSeconds(exercise.mechanic, rir, active.goal), exercise.name);
          else get().stopRest();
        } else {
          get().stopRest();
        }
      },

      addSet: (ei) => {
        const { active } = get();
        if (!active) return;
        set({
          active: {
            ...active,
            exercises: active.exercises.map((ex, i) => {
              if (i !== ei) return ex;
              const last = ex.sets[ex.sets.length - 1];
              const added: ActiveSet = {
                id: uid(),
                targetWeight: last?.targetWeight ?? 0,
                targetReps: last?.targetReps ?? ex.repRange[0],
                weight: last?.weight ?? 0,
                reps: last?.reps ?? ex.repRange[0],
                rir: null,
                done: false,
                isPR: false,
              };
              return { ...ex, sets: [...ex.sets, added] };
            }),
          },
        });
      },

      removeSet: (ei, si) => {
        const { active } = get();
        if (!active) return;
        set({
          active: {
            ...active,
            exercises: active.exercises.map((ex, i) =>
              i !== ei || ex.sets.length <= 1 ? ex : { ...ex, sets: ex.sets.filter((_, j) => j !== si) }
            ),
          },
        });
      },

      startRest: (seconds, label) =>
        set({ restEndsAt: Date.now() + seconds * 1000, restTotal: seconds, restLabel: label }),

      adjustRest: (delta) => {
        const { restEndsAt, restTotal } = get();
        if (!restEndsAt) return;
        set({ restEndsAt: restEndsAt + delta * 1000, restTotal: Math.max(5, restTotal + delta) });
      },

      stopRest: () => set({ restEndsAt: null }),

      finishWorkout: () => {
        const { active, history } = get();
        if (!active) return null;
        const summary = buildSummary(active, history);
        if (summary.session.sets === 0) return null;
        set({ history: [summary.session, ...history], active: null, restEndsAt: null });
        void syncSession(summary.session);
        return summary;
      },

      cancelWorkout: () => set({ active: null, restEndsAt: null }),

      addBodyWeight: (weightKg, date = dayKey(new Date())) => {
        set((s) => ({
          bodyMetrics: [...s.bodyMetrics.filter((m) => m.date !== date), { date, weightKg }].sort((a, b) =>
            a.date.localeCompare(b.date)
          ),
        }));
        void syncBodyWeight(date, weightKg);
      },
    }),
    {
      name: 'fitpulse-store-v1',
      partialize: (s) => ({
        history: s.history,
        bodyMetrics: s.bodyMetrics,
        prefs: s.prefs,
        active: s.active,
        restEndsAt: s.restEndsAt,
        restTotal: s.restTotal,
        restLabel: s.restLabel,
      }),
    }
  )
);

/** Évite les erreurs d'hydratation : false au premier rendu, true une fois monté côté client. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
