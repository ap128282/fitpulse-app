# FitPulse

PWA de musculation (Next.js 14 App Router, Tailwind, Zustand, Recharts, Supabase).

## Démarrage

```bash
npm install
cp .env.example .env.local   # facultatif : Supabase + clé OpenAI ou Gemini
npm run dev
```

- **Sans configuration**, l'app fonctionne en local (historique, records et poids sauvegardés dans le navigateur).
- **Supabase** : exécute `schema.sql` dans le SQL Editor, puis renseigne `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Les séances terminées sont alors synchronisées après connexion via `/login`.
- **Coach IA** : la séance est toujours générée par `lib/ai-engine.ts`. Avec `OPENAI_API_KEY` ou `GEMINI_API_KEY`, `/api/coach` ajoute un commentaire rédigé par le modèle.
- **PWA** : le service worker s'active en production (`npm run build && npm start`).
