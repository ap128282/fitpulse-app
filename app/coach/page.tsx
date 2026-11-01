'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Play, RefreshCw, Send, Sparkles } from 'lucide-react';
import { useHydrated, useStore } from '@/lib/store';
import {
  DURATIONS,
  EQUIPMENT_LABEL,
  FOCUS_LABEL,
  Focus,
  GOAL_LABEL,
  Goal,
  PlannedWorkout,
  parseCoachRequest,
} from '@/lib/ai-engine';

interface Message {
  id: number;
  role: 'user' | 'coach';
  text: string;
  plan?: PlannedWorkout;
}

const SUGGESTIONS = [
  '45 min prise de masse haut du corps',
  '30 min affinement jambes',
  '1h15 tonification full body',
  'Une séance dos et biceps de 45 min',
];

const fmt = (n: number) => String(Number(n.toFixed(2)));

function planSummary(plan: PlannedWorkout): string {
  return (
    `${plan.name} (${plan.duration} min, objectif ${GOAL_LABEL[plan.goal]}) : ` +
    plan.exercises
      .map((e) => `${e.name} ${e.sets.length}x${e.repRange[0]}-${e.repRange[1]} (${EQUIPMENT_LABEL[e.equipment]})`)
      .join(' ; ')
  );
}

function localReply(plan: PlannedWorkout): string {
  const poly = plan.exercises.filter((e) => e.mechanic === 'polyarticulaire').length;
  return (
    `Voici une séance ${FOCUS_LABEL[plan.focus].toLowerCase()} de ${plan.duration} minutes, orientée ${GOAL_LABEL[plan.goal].toLowerCase()}. ` +
    `${poly} mouvement${poly > 1 ? 's' : ''} polyarticulaire${poly > 1 ? 's' : ''} d'abord, puis de l'isolation. ` +
    `Vise un RIR de 1 à 2 sur chaque série : je réajuste tes charges à la prochaine séance.`
  );
}

export default function CoachPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const prefs = useStore((s) => s.prefs);
  const planWorkout = useStore((s) => s.planWorkout);
  const startWorkout = useStore((s) => s.startWorkout);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: 'coach',
      text: "Salut, je suis ton coach FitPulse. Dis-moi combien de temps tu as (30 min, 45 min, 1h15) et ton objectif (prise de masse, affinement, tonification) : je te prépare une séance sur mesure.",
    },
  ]);
  const [input, setInput] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(false);
  const idRef = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  const send = async (raw: string, overrides?: { focus?: Focus }) => {
    const text = raw.trim();
    if (!text || loading) return;
    setInput('');
    const parsed = parseCoachRequest(text);
    const plan = planWorkout({
      duration: parsed.duration ?? duration ?? undefined,
      goal: parsed.goal ?? goal ?? undefined,
      focus: overrides?.focus ?? parsed.focus,
      seed: Date.now() + Math.floor(Math.random() * 100000),
    });

    setMessages((m) => [...m, { id: idRef.current++, role: 'user', text }]);
    setLoading(true);

    let reply: string | null = null;
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, summary: planSummary(plan) }),
      });
      if (res.ok) reply = (await res.json()).reply ?? null;
    } catch {
      reply = null;
    }

    setMessages((m) => [...m, { id: idRef.current++, role: 'coach', text: reply ?? localReply(plan), plan }]);
    setLoading(false);
  };

  const launch = (plan: PlannedWorkout) => {
    startWorkout(plan);
    router.push('/workout');
  };

  if (!hydrated) return <div className="card h-40 animate-pulse" aria-busy="true" />;

  return (
    <div className="flex flex-col">
      <header className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet">
          <Bot size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold leading-tight">Coach IA</h1>
          <p className="text-xs text-muted">Séance sur mesure selon ton temps et ton objectif</p>
        </div>
      </header>

      <section className="card mb-4 space-y-3 p-3" aria-label="Réglages rapides">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">Temps disponible</p>
          <div className="flex gap-2">
            {DURATIONS.map((d) => {
              const selected = (duration ?? prefs.duration) === d;
              return (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`chip flex-1 ${selected ? 'border-lime bg-lime font-bold text-black' : ''}`}
                >
                  {d === 75 ? '1h15' : `${d} min`}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">Objectif</p>
          <div className="flex gap-2">
            {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => {
              const selected = (goal ?? prefs.goal) === g;
              return (
                <button
                  key={g}
                  onClick={() => setGoal(g)}
                  className={`chip flex-1 ${selected ? 'border-violet bg-violet font-bold' : ''}`}
                >
                  {GOAL_LABEL[g]}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="space-y-3" role="log" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm ${
                m.role === 'user' ? 'bg-lime font-semibold text-black' : 'card'
              }`}
            >
              <p>{m.text}</p>

              {m.plan && (
                <div className="mt-3 rounded-xl bg-bg p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-extrabold">{m.plan.name}</p>
                    <p className="text-xs text-muted">~{m.plan.estimatedMin} min</p>
                  </div>
                  <ul className="space-y-2">
                    {m.plan.exercises.map((e) => (
                      <li key={e.slug} className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{e.name}</p>
                          <p className="text-xs text-muted">
                            {EQUIPMENT_LABEL[e.equipment]} · repos ~{Math.round(e.restSeconds / 5) * 5}s
                          </p>
                        </div>
                        <p className="shrink-0 text-right text-xs tabular-nums">
                          <span className="font-bold text-lime">
                            {e.sets.length}×{e.repRange[0]}–{e.repRange[1]}
                          </span>
                          <br />
                          <span className="text-muted">{e.sets[0].weight > 0 ? `${fmt(e.sets[0].weight)} kg` : 'PDC'}</span>
                        </p>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex gap-2">
                    <button
                      className="btn-ghost flex-1 !py-2 text-sm"
                      onClick={() => send(`Autre séance ${FOCUS_LABEL[m.plan!.focus]}`, { focus: m.plan!.focus })}
                      disabled={loading}
                    >
                      <RefreshCw size={15} />
                      Varier
                    </button>
                    <button className="btn-lime flex-[2] !py-2 text-sm" onClick={() => launch(m.plan!)}>
                      <Play size={15} />
                      Lancer la séance
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="card flex items-center gap-2 px-4 py-3 text-sm text-muted">
              <Sparkles size={15} className="animate-pulse text-violet" />
              Je construis ta séance…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => send(s)} className="chip shrink-0" disabled={loading}>
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-[76px] mt-3 flex gap-2 bg-bg/95 py-2 backdrop-blur"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ex : 45 min, prise de masse, pecs et triceps"
          className="field flex-1"
          aria-label="Message pour le coach"
        />
        <button type="submit" className="btn-lime !px-4" disabled={loading || !input.trim()} aria-label="Envoyer">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
