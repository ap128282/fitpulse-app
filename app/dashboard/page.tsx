'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot, Clock, Dumbbell, Flame, Play, Trophy, Zap } from 'lucide-react';
import { dayKey, useHydrated, useStore } from '@/lib/store';
import { FOCUS_SHORT, GOAL_LABEL, nextFocus } from '@/lib/ai-engine';

const WEEKS = 18;
const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // lundi = 0
  x.setDate(x.getDate() - dow);
  return x;
}

function cellColor(volume: number): string {
  if (volume <= 0) return '#1C1C1E';
  if (volume < 3000) return 'rgba(204,255,0,0.30)';
  if (volume < 6000) return 'rgba(204,255,0,0.55)';
  if (volume < 9000) return 'rgba(204,255,0,0.80)';
  return '#CCFF00';
}

export default function DashboardPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const history = useStore((s) => s.history);
  const prefs = useStore((s) => s.prefs);
  const active = useStore((s) => s.active);
  const planWorkout = useStore((s) => s.planWorkout);
  const startWorkout = useStore((s) => s.startWorkout);

  const stats = useMemo(() => {
    const volumeByDay = new Map<string, number>();
    history.forEach((s) => {
      const k = dayKey(new Date(s.date));
      volumeByDay.set(k, (volumeByDay.get(k) ?? 0) + s.volume);
    });

    const now = new Date();
    const weekAgo = Date.now() - 7 * 86400000;
    const monthAgo = Date.now() - 30 * 86400000;
    const last7 = history.filter((s) => new Date(s.date).getTime() >= weekAgo);
    const prs30 = history
      .filter((s) => new Date(s.date).getTime() >= monthAgo)
      .reduce((n, s) => n + s.prs, 0);

    // Série de semaines consécutives avec au moins une séance
    const weeksWithSession = new Set(history.map((s) => dayKey(mondayOf(new Date(s.date)))));
    let streak = 0;
    const cursor = mondayOf(now);
    if (!weeksWithSession.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 7); // semaine en cours encore vide : pas de rupture
    while (weeksWithSession.has(dayKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 7);
    }

    // Grille heatmap : colonnes = semaines, lignes = jours (lundi → dimanche)
    const start = mondayOf(now);
    start.setDate(start.getDate() - (WEEKS - 1) * 7);
    const columns = Array.from({ length: WEEKS }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const date = new Date(start);
        date.setDate(start.getDate() + w * 7 + d);
        const future = date.getTime() > now.getTime();
        return { key: dayKey(date), volume: volumeByDay.get(dayKey(date)) ?? 0, future, date };
      })
    );

    return {
      columns,
      sessions7: last7.length,
      volume7: last7.reduce((n, s) => n + s.volume, 0),
      prs30,
      streak,
    };
  }, [history]);

  if (!hydrated) return <div className="card h-40 animate-pulse" aria-busy="true" />;

  const suggested = nextFocus(history[0]?.focus);

  const quickStart = (duration: number) => {
    startWorkout(planWorkout({ duration, focus: suggested }));
    router.push('/workout');
  };

  const tiles = [
    { label: 'Séances (7 j)', value: String(stats.sessions7), Icon: Dumbbell, tint: 'text-lime' },
    { label: 'Volume (7 j)', value: `${Math.round(stats.volume7 / 100) / 10}t`, Icon: Zap, tint: 'text-violet' },
    { label: 'Semaines d\'affilée', value: String(stats.streak), Icon: Flame, tint: 'text-lime' },
    { label: 'Records (30 j)', value: String(stats.prs30), Icon: Trophy, tint: 'text-violet' },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-extrabold leading-tight">
          {prefs.name ? `Salut ${prefs.name}` : 'Salut'}
        </h1>
        <p className="text-sm text-muted">
          Objectif actuel : <span className="font-semibold text-white">{GOAL_LABEL[prefs.goal]}</span>
        </p>
      </header>

      {active ? (
        <Link href="/workout" className="card flex items-center justify-between border-violet p-4">
          <div>
            <p className="text-xs font-semibold text-violet">Séance en cours</p>
            <p className="text-lg font-extrabold">{active.name}</p>
          </div>
          <span className="btn-violet !px-4 !py-2 text-sm">
            <Play size={16} />
            Reprendre
          </span>
        </Link>
      ) : (
        <section className="card p-4" aria-label="Raccourcis de séance">
          <p className="text-xs font-semibold text-muted">Séance suggérée</p>
          <p className="mb-3 text-xl font-extrabold">{FOCUS_SHORT[suggested]}</p>
          <div className="grid grid-cols-3 gap-2">
            {[30, 45, 75].map((d) => (
              <button key={d} onClick={() => quickStart(d)} className="btn-lime flex-col !gap-0 !py-3">
                <span className="flex items-center gap-1 text-lg">
                  <Clock size={15} />
                  {d === 75 ? '1h15' : d}
                </span>
                <span className="text-[11px] font-semibold opacity-70">{d === 75 ? '' : 'minutes'}</span>
              </button>
            ))}
          </div>
          <Link href="/coach" className="btn-ghost mt-3 w-full text-sm">
            <Bot size={16} />
            Demander une séance au Coach IA
          </Link>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3" aria-label="Résumé">
        {tiles.map(({ label, value, Icon, tint }) => (
          <div key={label} className="card p-4">
            <Icon size={18} className={tint} />
            <p className="mt-2 text-3xl font-extrabold tabular-nums">{value}</p>
            <p className="text-xs text-muted">{label}</p>
          </div>
        ))}
      </section>

      <section className="card p-4" aria-label="Assiduité">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-extrabold">Assiduité</h2>
          <p className="text-xs text-muted">{WEEKS} dernières semaines</p>
        </div>
        <div className="flex gap-1.5">
          <div className="flex flex-col justify-between py-0.5 text-[9px] text-muted">
            {DAY_LABELS.map((l, i) => (
              <span key={i} className="h-[14px] leading-[14px]">
                {i % 2 === 0 ? l : ''}
              </span>
            ))}
          </div>
          <div className="flex flex-1 justify-between gap-[3px] overflow-x-auto">
            {stats.columns.map((col, w) => (
              <div key={w} className="flex flex-col gap-[3px]">
                {col.map((c) => (
                  <div
                    key={c.key}
                    title={c.future ? '' : `${c.date.toLocaleDateString('fr-FR')} : ${c.volume} kg`}
                    className="h-[14px] w-[14px] rounded-[3px]"
                    style={{ background: c.future ? 'transparent' : cellColor(c.volume) }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted">
          Moins
          {[0, 1000, 4000, 7000, 10000].map((v) => (
            <span key={v} className="h-3 w-3 rounded-[3px]" style={{ background: cellColor(v) }} />
          ))}
          Plus
        </div>
      </section>

      <section aria-label="Dernières séances">
        <h2 className="mb-2 text-base font-extrabold">Dernières séances</h2>
        {history.length === 0 ? (
          <div className="card p-5 text-center text-sm text-muted">
            Aucune séance enregistrée. Lance ta première séance pour remplir ton historique.
          </div>
        ) : (
          <ul className="space-y-2">
            {history.slice(0, 5).map((s) => (
              <li key={s.id} className="card flex items-center justify-between p-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{s.name}</p>
                  <p className="text-xs text-muted">
                    {new Date(s.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
                    {s.durationMin} min · {s.sets} séries
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold tabular-nums text-lime">{s.volume.toLocaleString('fr-FR')} kg</p>
                  {s.prs > 0 && (
                    <p className="flex items-center justify-end gap-1 text-xs text-violet">
                      <Trophy size={12} />
                      {s.prs} PR
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
