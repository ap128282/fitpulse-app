'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  Flag,
  History as HistoryIcon,
  Minus,
  Plus,
  Scale,
  Sparkles,
  Timer,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import { buildSummary, FinishSummary, lastPerformance, useHydrated, useStore } from '@/lib/store';
import {
  BAR_PLATES,
  DUMBBELL_PLATES,
  EQUIPMENT_LABEL,
  Equipment,
  computeNextTarget,
  epley1RM,
  plateBreakdown,
} from '@/lib/ai-engine';

const fmt = (n: number) => String(Number(n.toFixed(2)));

// ---------------------------------------------------------------------------
// Chrono de séance
// ---------------------------------------------------------------------------

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const total = Math.max(0, Math.floor((now - since) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return <span className="tabular-nums">{h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`}</span>;
}

// ---------------------------------------------------------------------------
// Minuteur de repos (popup + alerte sonore / vibration)
// ---------------------------------------------------------------------------

function alertRestOver() {
  try {
    navigator.vibrate?.([200, 100, 200, 100, 300]);
  } catch {
    /* ignore */
  }
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.25, 0.5].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.15);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {
    /* ignore */
  }
}

function RestTimer() {
  const restEndsAt = useStore((s) => s.restEndsAt);
  const restTotal = useStore((s) => s.restTotal);
  const restLabel = useStore((s) => s.restLabel);
  const adjustRest = useStore((s) => s.adjustRest);
  const stopRest = useStore((s) => s.stopRest);

  const [now, setNow] = useState(Date.now());
  const [finished, setFinished] = useState(false);
  const alertedFor = useRef<number | null>(null);

  useEffect(() => {
    setFinished(false);
    if (!restEndsAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [restEndsAt]);

  const remainingMs = restEndsAt ? restEndsAt - now : 0;
  const remaining = Math.max(0, Math.ceil(remainingMs / 1000));

  useEffect(() => {
    if (restEndsAt && remainingMs <= 0 && alertedFor.current !== restEndsAt) {
      alertedFor.current = restEndsAt;
      setFinished(true);
      alertRestOver();
    }
  }, [restEndsAt, remainingMs]);

  if (!restEndsAt) return null;

  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const progress = restTotal > 0 ? Math.min(1, Math.max(0, remaining / restTotal)) : 0;
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed inset-x-3 bottom-[84px] z-50 mx-auto max-w-md rounded-2xl border p-3 shadow-2xl ${
        finished ? 'animate-pulse border-lime bg-[#24290a]' : 'border-line bg-card'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16 shrink-0">
          <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
            <circle cx="32" cy="32" r={radius} fill="none" stroke="#2C2C2E" strokeWidth="6" />
            <circle
              cx="32"
              cy="32"
              r={radius}
              fill="none"
              stroke={finished ? '#CCFF00' : '#6C5CE7'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold tabular-nums">
            {mm}:{ss}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-bold">
            <Timer size={15} className={finished ? 'text-lime' : 'text-violet'} />
            {finished ? 'Repos terminé : série suivante !' : 'Repos'}
          </p>
          <p className="truncate text-xs text-muted">{restLabel}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {!finished && (
            <>
              <button onClick={() => adjustRest(-15)} className="btn-ghost !px-2.5 !py-2 text-xs" aria-label="Retirer 15 secondes">
                -15s
              </button>
              <button onClick={() => adjustRest(15)} className="btn-ghost !px-2.5 !py-2 text-xs" aria-label="Ajouter 15 secondes">
                +15s
              </button>
            </>
          )}
          <button onClick={stopRest} className={`${finished ? 'btn-lime' : 'btn-ghost'} !px-3 !py-2 text-xs`}>
            {finished ? 'Go' : 'Passer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calculateur de plaques
// ---------------------------------------------------------------------------

const PLATE_COLOR: Record<number, string> = {
  25: '#E74C3C',
  20: '#3498DB',
  15: '#F1C40F',
  10: '#2ECC71',
  5: '#ECF0F1',
  2.5: '#8E8E93',
  1.25: '#B2BEC3',
  0.5: '#6C5CE7',
};

function PlateVisual({ plates }: { plates: number[] }) {
  return (
    <>
      {plates.map((p, i) => (
        <div
          key={`${p}-${i}`}
          title={`${p} kg`}
          className="flex items-center justify-center rounded-[3px] text-[9px] font-bold text-black"
          style={{
            height: 36 + p * 3.2,
            width: p >= 10 ? 14 : p >= 2.5 ? 10 : 7,
            background: PLATE_COLOR[p] ?? '#8E8E93',
          }}
        />
      ))}
    </>
  );
}

function PlateCalculator({
  initialWeight,
  equipment,
  onClose,
}: {
  initialWeight: number;
  equipment: Equipment;
  onClose: () => void;
}) {
  const isDumbbell = equipment === 'halteres';
  const [total, setTotal] = useState(initialWeight);
  const [bar, setBar] = useState(isDumbbell ? 2.5 : 20);
  const available = isDumbbell ? DUMBBELL_PLATES : BAR_PLATES;
  const bars = isDumbbell
    ? [
        { v: 2.5, l: 'Poignée 2,5 kg' },
        { v: 3.5, l: 'Poignée 3,5 kg' },
        { v: 5, l: 'Poignée 5 kg' },
      ]
    : [
        { v: 20, l: 'Barre 20 kg' },
        { v: 15, l: 'Barre 15 kg' },
        { v: 10, l: 'Barre EZ 10 kg' },
      ];
  const res = plateBreakdown(total, bar, available);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-3" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Calculateur de plaques"
        className="card w-full max-w-md p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-extrabold">
            <Scale size={18} className="text-lime" />
            Calculateur de plaques
          </h3>
          <button onClick={onClose} aria-label="Fermer" className="rounded-full p-1.5 text-muted">
            <X size={20} />
          </button>
        </div>

        <p className="mb-2 text-xs text-muted">
          {isDumbbell ? 'Charge par haltère réglable (plaques de chaque côté).' : 'Charge totale sur la barre.'}
        </p>

        <div className="mb-3 flex items-center gap-2">
          <button className="btn-ghost !px-3" onClick={() => setTotal((t) => Math.max(0, Number((t - 2.5).toFixed(2))))} aria-label="Moins 2,5 kg">
            <Minus size={16} />
          </button>
          <div className="relative flex-1">
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              value={total}
              onChange={(e) => setTotal(Number(e.target.value) || 0)}
              className="field text-center text-2xl font-extrabold tabular-nums"
              aria-label="Charge totale en kilos"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">kg</span>
          </div>
          <button className="btn-ghost !px-3" onClick={() => setTotal((t) => Number((t + 2.5).toFixed(2)))} aria-label="Plus 2,5 kg">
            <Plus size={16} />
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {bars.map((b) => (
            <button
              key={b.v}
              onClick={() => setBar(b.v)}
              className={`chip ${bar === b.v ? 'border-lime bg-lime text-black' : ''}`}
            >
              {b.l}
            </button>
          ))}
        </div>

        <div className="mb-3 flex h-36 items-center justify-center gap-0.5 overflow-hidden rounded-xl bg-bg px-2">
          {res.valid ? (
            <>
              <PlateVisual plates={[...res.plates].reverse()} />
              <div className="h-3 w-16 rounded bg-muted" />
              <PlateVisual plates={res.plates} />
            </>
          ) : (
            <p className="text-sm text-muted">La charge est inférieure au poids de la barre.</p>
          )}
        </div>

        {res.valid && (
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted">Par côté : </span>
              <span className="font-bold">
                {res.plates.length > 0 ? res.plates.map((p) => fmt(p)).join(' + ') + ' kg' : 'aucune plaque'}
              </span>
            </p>
            {res.remainder > 0 && (
              <p className="text-[#FF9F43]">
                Charge exacte impossible avec ces plaques : il manque {fmt(res.remainder)} kg.
              </p>
            )}
          </div>
        )}

        <button onClick={onClose} className="btn-lime mt-4 w-full">
          Fermer
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal de fin de séance
// ---------------------------------------------------------------------------

function FinishModal({
  summary,
  onConfirm,
  onClose,
}: {
  summary: FinishSummary;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { session, prs } = summary;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-3" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Fin de séance"
        className="card w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="flex items-center gap-2 text-xl font-extrabold">
          <Flag size={20} className="text-lime" />
          Séance terminée
        </h3>
        <p className="mb-4 text-sm text-muted">{session.name}</p>

        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-bg p-3">
            <p className="text-xl font-extrabold tabular-nums">{session.durationMin}</p>
            <p className="text-xs text-muted">minutes</p>
          </div>
          <div className="rounded-xl bg-bg p-3">
            <p className="text-xl font-extrabold tabular-nums text-lime">{session.volume.toLocaleString('fr-FR')}</p>
            <p className="text-xs text-muted">kg de volume</p>
          </div>
          <div className="rounded-xl bg-bg p-3">
            <p className="text-xl font-extrabold tabular-nums">{session.sets}</p>
            <p className="text-xs text-muted">séries</p>
          </div>
        </div>

        <div className="mb-5">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold">
            <Trophy size={16} className="text-lime" />
            Records battus ({prs.length})
          </p>
          {prs.length === 0 ? (
            <p className="text-sm text-muted">Pas de record cette fois : la régularité paie aussi.</p>
          ) : (
            <ul className="space-y-1.5">
              {prs.map((p) => (
                <li key={p.name} className="flex items-center justify-between rounded-xl bg-bg px-3 py-2 text-sm">
                  <span className="font-semibold">{p.name}</span>
                  <span className="tabular-nums text-lime">
                    1RM {fmt(p.previous)} → {fmt(p.e1rm)} kg
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-ghost flex-1">
            Continuer
          </button>
          <button onClick={onConfirm} className="btn-lime flex-[2]">
            Enregistrer la séance
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export default function WorkoutLogger() {
  const router = useRouter();
  const hydrated = useHydrated();

  const active = useStore((s) => s.active);
  const history = useStore((s) => s.history);
  const updateSet = useStore((s) => s.updateSet);
  const toggleSet = useStore((s) => s.toggleSet);
  const addSet = useStore((s) => s.addSet);
  const removeSet = useStore((s) => s.removeSet);
  const finishWorkout = useStore((s) => s.finishWorkout);
  const cancelWorkout = useStore((s) => s.cancelWorkout);
  const planWorkout = useStore((s) => s.planWorkout);
  const startWorkout = useStore((s) => s.startWorkout);

  const [plate, setPlate] = useState<{ weight: number; equipment: Equipment } | null>(null);
  const [summary, setSummary] = useState<FinishSummary | null>(null);
  const [error, setError] = useState('');

  if (!hydrated) {
    return <div className="card h-40 animate-pulse" aria-busy="true" />;
  }

  if (!active) {
    return (
      <div className="card p-6 text-center">
        <h1 className="mb-2 text-2xl font-extrabold">Aucune séance en cours</h1>
        <p className="mb-5 text-sm text-muted">
          Lance la séance suggérée par FitPulse ou demande une séance sur mesure au coach.
        </p>
        <div className="flex flex-col gap-2">
          <button className="btn-lime" onClick={() => startWorkout(planWorkout())}>
            <Sparkles size={18} />
            Lancer la séance suggérée
          </button>
          <Link href="/coach" className="btn-ghost">
            Parler au Coach IA
          </Link>
        </div>
      </div>
    );
  }

  const totalSets = active.exercises.reduce((n, e) => n + e.sets.length, 0);
  const doneSets = active.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);

  const onFinishClick = () => {
    const s = buildSummary(active, history);
    if (s.session.sets === 0) {
      setError('Valide au moins une série avant de terminer la séance.');
      return;
    }
    setError('');
    setSummary(s);
  };

  const onConfirmFinish = () => {
    finishWorkout();
    setSummary(null);
    router.push('/dashboard');
  };

  const onCancel = () => {
    if (window.confirm('Abandonner la séance en cours ? Les séries saisies seront perdues.')) cancelWorkout();
  };

  return (
    <div>
      <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold">{active.name}</h1>
            <p className="text-xs text-muted">
              <Elapsed since={active.startedAt} /> · {doneSets}/{totalSets} séries
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onCancel} className="rounded-full p-2 text-muted" aria-label="Abandonner la séance">
              <X size={20} />
            </button>
            <button onClick={onFinishClick} className="btn-lime !px-4 !py-2 text-sm">
              <Flag size={16} />
              Terminer
            </button>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-lime transition-all"
            style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }}
          />
        </div>
        {error && <p className="mt-2 text-sm text-[#FF6B6B]">{error}</p>}
      </div>

      <div className="space-y-4">
        {active.exercises.map((ex, ei) => {
          const last = lastPerformance(history, ex.slug);
          const done = ex.sets.filter((s) => s.done);
          const bestDone = done.length
            ? done.reduce((a, b) =>
                epley1RM(b.weight, b.reps, b.rir ?? 2) > epley1RM(a.weight, a.reps, a.rir ?? 2) ? b : a
              )
            : null;
          const next = bestDone
            ? computeNextTarget(
                { weight: bestDone.weight, reps: bestDone.reps, rir: bestDone.rir ?? 2 },
                ex.step,
                ex.repRange
              )
            : null;
          const canPlate = ex.equipment === 'barre' || ex.equipment === 'halteres';

          return (
            <section key={ex.slug} className="card p-4" aria-label={ex.name}>
              <div className="mb-1 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-base font-extrabold leading-tight">{ex.name}</h2>
                  <p className="text-xs text-muted">
                    {EQUIPMENT_LABEL[ex.equipment]} · {ex.mechanic === 'polyarticulaire' ? 'Polyarticulaire' : 'Isolation'}{' '}
                    · {ex.repRange[0]}–{ex.repRange[1]} reps
                  </p>
                </div>
                {canPlate && (
                  <button
                    onClick={() =>
                      setPlate({
                        weight: ex.sets.find((s) => !s.done)?.weight ?? ex.sets[0]?.weight ?? 0,
                        equipment: ex.equipment,
                      })
                    }
                    className="btn-ghost !px-3 !py-2 text-xs"
                    aria-label={`Calculateur de plaques pour ${ex.name}`}
                  >
                    <Scale size={15} />
                    Plaques
                  </button>
                )}
              </div>

              <p className="mb-3 flex items-start gap-1.5 text-xs text-violet">
                <Sparkles size={13} className="mt-0.5 shrink-0" />
                <span>{ex.reason}</span>
              </p>

              {last && (
                <p className="mb-3 flex items-start gap-1.5 rounded-lg bg-bg px-2.5 py-2 text-xs text-muted">
                  <HistoryIcon size={13} className="mt-0.5 shrink-0" />
                  <span>
                    {new Date(last.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} :{' '}
                    {last.sets.map((s) => `${fmt(s.weight)}×${s.reps}`).join(' · ')}
                  </span>
                </p>
              )}

              <div className="mb-1 grid grid-cols-[1.5rem_1fr_4.25rem_3.75rem_3.25rem_2.5rem] items-center gap-2 px-1 text-[11px] font-semibold text-muted">
                <span>#</span>
                <span>Précédent</span>
                <span className="text-center">kg</span>
                <span className="text-center">Reps</span>
                <span className="text-center">RIR</span>
                <span />
              </div>

              <div className="space-y-1.5">
                {ex.sets.map((s, si) => {
                  const prev = last?.sets[si];
                  return (
                    <div
                      key={s.id}
                      className={`grid grid-cols-[1.5rem_1fr_4.25rem_3.75rem_3.25rem_2.5rem] items-center gap-2 rounded-xl px-1 py-1 ${
                        s.done ? 'bg-lime/10' : ''
                      }`}
                    >
                      <button
                        onClick={() => removeSet(ei, si)}
                        className="group relative text-sm font-bold text-muted"
                        aria-label={`Supprimer la série ${si + 1}`}
                        disabled={ex.sets.length <= 1}
                      >
                        <span className="group-hover:invisible">{si + 1}</span>
                        <Trash2 size={13} className="invisible absolute inset-0 m-auto group-hover:visible" />
                      </button>
                      <span className="truncate text-xs text-muted tabular-nums">
                        {prev ? `${fmt(prev.weight)}×${prev.reps}` : '—'}
                        {s.isPR && (
                          <span className="ml-1 inline-flex items-center gap-0.5 font-bold text-lime">
                            <Trophy size={11} />
                            PR
                          </span>
                        )}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        min="0"
                        value={s.weight}
                        onChange={(e) => updateSet(ei, si, { weight: Number(e.target.value) || 0 })}
                        aria-label={`Charge série ${si + 1}`}
                        className="w-full rounded-lg border border-line bg-bg px-1 py-2 text-center font-bold tabular-nums focus:border-lime focus:outline-none"
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        step="1"
                        min="0"
                        value={s.reps}
                        onChange={(e) => updateSet(ei, si, { reps: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                        aria-label={`Répétitions série ${si + 1}`}
                        className="w-full rounded-lg border border-line bg-bg px-1 py-2 text-center font-bold tabular-nums focus:border-lime focus:outline-none"
                      />
                      <select
                        value={s.rir === null ? '' : String(s.rir)}
                        onChange={(e) =>
                          updateSet(ei, si, { rir: e.target.value === '' ? null : Number(e.target.value) })
                        }
                        aria-label={`RIR série ${si + 1}`}
                        className={`w-full rounded-lg border border-line bg-bg px-0.5 py-2 text-center text-sm font-bold focus:border-lime focus:outline-none ${
                          s.rir === 0 ? 'text-[#FF6B6B]' : s.rir !== null && s.rir <= 2 ? 'text-lime' : 'text-white'
                        }`}
                      >
                        <option value="">—</option>
                        <option value="0">0</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4+</option>
                      </select>
                      <button
                        onClick={() => toggleSet(ei, si)}
                        aria-pressed={s.done}
                        aria-label={s.done ? `Série ${si + 1} validée` : `Valider la série ${si + 1}`}
                        className={`flex h-10 w-10 items-center justify-center rounded-lg border transition active:scale-90 ${
                          s.done ? 'border-lime bg-lime text-black' : 'border-line bg-bg text-muted'
                        }`}
                      >
                        <Check size={20} strokeWidth={3} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button onClick={() => addSet(ei)} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-violet">
                <Plus size={16} />
                Ajouter une série
              </button>

              {next && (
                <p className="mt-3 rounded-lg border border-violet/40 bg-violet/10 px-3 py-2 text-xs">
                  <span className="font-bold text-white">
                    Prochaine séance : {fmt(next.weight)} kg × {next.reps}
                  </span>
                  <span className="text-muted"> · {next.reason}</span>
                </p>
              )}
            </section>
          );
        })}
      </div>

      <RestTimer />
      {plate && <PlateCalculator initialWeight={plate.weight} equipment={plate.equipment} onClose={() => setPlate(null)} />}
      {summary && <FinishModal summary={summary} onConfirm={onConfirmFinish} onClose={() => setSummary(null)} />}
    </div>
  );
}
