'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn, LogOut } from 'lucide-react';
import { useHydrated, useStore } from '@/lib/store';
import { DURATIONS, GOAL_LABEL, Goal } from '@/lib/ai-engine';
import { supabase } from '@/lib/supabase';

export default function ProfilePage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPrefs);
  const history = useStore((s) => s.history);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  if (!hydrated) return <div className="card h-40 animate-pulse" aria-busy="true" />;

  const logout = async () => {
    await supabase?.auth.signOut();
    setEmail(null);
    router.push('/login');
  };

  const totalVolume = history.reduce((n, s) => n + s.volume, 0);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-extrabold leading-tight">Profil</h1>
        <p className="text-sm text-muted">{email ?? 'Mode local : données enregistrées sur cet appareil'}</p>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-3xl font-extrabold tabular-nums text-lime">{history.length}</p>
          <p className="text-xs text-muted">séances terminées</p>
        </div>
        <div className="card p-4">
          <p className="text-3xl font-extrabold tabular-nums text-violet">{Math.round(totalVolume / 1000)}t</p>
          <p className="text-xs text-muted">soulevées au total</p>
        </div>
      </section>

      <section className="card space-y-4 p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">Prénom</span>
          <input
            value={prefs.name}
            onChange={(e) => setPrefs({ name: e.target.value })}
            className="field"
            placeholder="Ton prénom"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">Poids de corps (kg)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="30"
            max="300"
            value={prefs.weightKg}
            onChange={(e) => setPrefs({ weightKg: Number(e.target.value) || 0 })}
            className="field"
          />
        </label>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">Objectif par défaut</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
              <button
                key={g}
                onClick={() => setPrefs({ goal: g })}
                className={`chip ${prefs.goal === g ? 'border-violet bg-violet font-bold' : ''}`}
              >
                {GOAL_LABEL[g]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">Durée par défaut</p>
          <div className="flex gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => setPrefs({ duration: d })}
                className={`chip flex-1 ${prefs.duration === d ? 'border-lime bg-lime font-bold text-black' : ''}`}
              >
                {d === 75 ? '1h15' : `${d} min`}
              </button>
            ))}
          </div>
        </div>
      </section>

      {email ? (
        <button onClick={logout} className="btn-ghost w-full">
          <LogOut size={18} />
          Se déconnecter
        </button>
      ) : (
        <Link href="/login" className="btn-violet w-full">
          <LogIn size={18} />
          Se connecter pour synchroniser
        </Link>
      )}
    </div>
  );
}
