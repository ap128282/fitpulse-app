'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Plus } from 'lucide-react';
import { dayKey, useHydrated, useStore } from '@/lib/store';
import { epley1RM } from '@/lib/ai-engine';

const tooltipStyle = {
  contentStyle: {
    background: '#1C1C1E',
    border: '1px solid #2C2C2E',
    borderRadius: 12,
    color: '#FFFFFF',
    fontSize: 12,
  },
  labelStyle: { color: '#8E8E93' },
  cursor: { stroke: '#2C2C2E' },
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

function Empty({ text }: { text: string }) {
  return <p className="flex h-44 items-center justify-center text-center text-sm text-muted">{text}</p>;
}

export default function AnalyticsPage() {
  const hydrated = useHydrated();
  const history = useStore((s) => s.history);
  const bodyMetrics = useStore((s) => s.bodyMetrics);
  const addBodyWeight = useStore((s) => s.addBodyWeight);
  const prefsWeight = useStore((s) => s.prefs.weightKg);

  const [slug, setSlug] = useState('');
  const [weightInput, setWeightInput] = useState('');

  const exercises = useMemo(() => {
    const map = new Map<string, string>();
    history.forEach((s) => s.exercises.forEach((e) => map.set(e.slug, e.name)));
    return Array.from(map, ([value, name]) => ({ value, name })).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [history]);

  const selected = slug && exercises.some((e) => e.value === slug) ? slug : exercises[0]?.value ?? '';

  const oneRmData = useMemo(() => {
    if (!selected) return [];
    return [...history]
      .reverse()
      .map((s) => {
        const ex = s.exercises.find((e) => e.slug === selected);
        if (!ex) return null;
        const best = Math.max(...ex.sets.map((x) => epley1RM(x.weight, x.reps, x.rir)));
        return best > 0 ? { date: shortDate(s.date), e1rm: best } : null;
      })
      .filter((x): x is { date: string; e1rm: number } => x !== null);
  }, [history, selected]);

  const volumeData = useMemo(
    () =>
      [...history]
        .slice(0, 12)
        .reverse()
        .map((s) => ({ date: shortDate(s.date), volume: s.volume })),
    [history]
  );

  const weightData = useMemo(
    () => bodyMetrics.map((m) => ({ date: shortDate(m.date), poids: m.weightKg })),
    [bodyMetrics]
  );

  if (!hydrated) return <div className="card h-40 animate-pulse" aria-busy="true" />;

  const submitWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(weightInput.replace(',', '.'));
    if (!Number.isFinite(v) || v < 20 || v > 400) return;
    addBodyWeight(Number(v.toFixed(1)), dayKey(new Date()));
    setWeightInput('');
  };

  const firstE = oneRmData[0]?.e1rm;
  const lastE = oneRmData[oneRmData.length - 1]?.e1rm;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-extrabold leading-tight">Progression</h1>
        <p className="text-sm text-muted">Force, volume et poids de corps</p>
      </header>

      <section className="card p-4" aria-label="1RM théorique">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-extrabold">1RM théorique</h2>
          {exercises.length > 0 && (
            <select
              value={selected}
              onChange={(e) => setSlug(e.target.value)}
              className="field !w-auto max-w-[60%] !py-2 text-sm"
              aria-label="Exercice"
            >
              {exercises.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {oneRmData.length === 0 ? (
          <Empty text="Termine une séance avec charge pour voir ton 1RM estimé (formule d'Epley, RIR inclus)." />
        ) : (
          <>
            <p className="mb-2 text-sm">
              <span className="text-2xl font-extrabold tabular-nums text-lime">{lastE} kg</span>
              {oneRmData.length > 1 && firstE !== undefined && lastE !== undefined && (
                <span className="ml-2 text-xs text-muted">
                  {lastE >= firstE ? '+' : ''}
                  {Number((lastE - firstE).toFixed(1))} kg depuis le début
                </span>
              )}
            </p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={oneRmData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#2C2C2E" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="#8E8E93" fontSize={11} tickLine={false} />
                  <YAxis stroke="#8E8E93" fontSize={11} tickLine={false} axisLine={false} domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v} kg`, '1RM']} />
                  <Line type="monotone" dataKey="e1rm" stroke="#CCFF00" strokeWidth={3} dot={{ r: 3, fill: '#CCFF00' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </section>

      <section className="card p-4" aria-label="Volume total">
        <h2 className="mb-3 text-base font-extrabold">Volume par séance</h2>
        {volumeData.length === 0 ? (
          <Empty text="Ton volume (charge × répétitions) apparaîtra ici après ta première séance." />
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid stroke="#2C2C2E" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="#8E8E93" fontSize={11} tickLine={false} />
                <YAxis stroke="#8E8E93" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(108,92,231,0.15)' }} formatter={(v: number) => [`${v.toLocaleString('fr-FR')} kg`, 'Volume']} />
                <Bar dataKey="volume" fill="#6C5CE7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="card p-4" aria-label="Poids corporel">
        <h2 className="mb-3 text-base font-extrabold">Poids corporel</h2>
        {weightData.length === 0 ? (
          <Empty text="Ajoute ton poids pour suivre ton évolution." />
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#2C2C2E" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="#8E8E93" fontSize={11} tickLine={false} />
                <YAxis stroke="#8E8E93" fontSize={11} tickLine={false} axisLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v} kg`, 'Poids']} />
                <Line type="monotone" dataKey="poids" stroke="#6C5CE7" strokeWidth={3} dot={{ r: 3, fill: '#6C5CE7' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <form onSubmit={submitWeight} className="mt-3 flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            placeholder={`Poids du jour (ex : ${prefsWeight})`}
            className="field flex-1"
            aria-label="Poids du jour en kilos"
          />
          <button type="submit" className="btn-lime !px-4" aria-label="Ajouter ce poids">
            <Plus size={18} />
          </button>
        </form>
      </section>
    </div>
  );
}
