'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Dumbbell } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (!supabase) {
      setError('Supabase n\'est pas configuré : renseigne NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local.');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        if (data.session) router.push('/dashboard');
        else setInfo('Compte créé. Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] flex-col justify-center">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-lime text-black">
          <Dumbbell size={34} strokeWidth={2.5} />
        </div>
        <h1 className="text-4xl font-extrabold">FitPulse</h1>
        <p className="mt-1 text-sm text-muted">Ta progression, pilotée par le RIR.</p>
      </div>

      <form onSubmit={submit} className="card space-y-3 p-5">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-bg p-1" role="tablist">
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-lg py-2 text-sm font-bold transition ${mode === m ? 'bg-lime text-black' : 'text-muted'}`}
            >
              {m === 'login' ? 'Connexion' : 'Inscription'}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
            placeholder="toi@exemple.fr"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">Mot de passe</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
            placeholder="6 caractères minimum"
          />
        </label>

        {error && <p role="alert" className="text-sm text-[#FF6B6B]">{error}</p>}
        {info && <p role="status" className="text-sm text-lime">{info}</p>}

        <button type="submit" className="btn-lime w-full" disabled={loading}>
          {loading ? 'Patiente…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
        </button>
      </form>

      <Link href="/dashboard" className="mt-5 text-center text-sm font-semibold text-violet">
        Continuer sans compte {isSupabaseConfigured ? '' : '(mode local)'}
      </Link>
    </div>
  );
}
