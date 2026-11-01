// FitPulse : moteur de progression et de génération de séance (100 % local, déterministe).

export type Goal = 'masse' | 'affinement' | 'tonification';
export type Focus = 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full';
export type Muscle =
  | 'pectoraux' | 'dos' | 'epaules' | 'biceps' | 'triceps'
  | 'quadriceps' | 'ischios' | 'fessiers' | 'mollets' | 'abdos';
export type Equipment = 'barre' | 'halteres' | 'machine' | 'poulie' | 'poids-du-corps';
export type Mechanic = 'polyarticulaire' | 'isolation';

export interface Exercise {
  slug: string;
  name: string;
  muscle: Muscle;
  equipment: Equipment;
  mechanic: Mechanic;
  /** Charge de départ de référence (kg) pour un pratiquant de 75 kg. 0 = poids du corps. */
  startKg: number;
  /** Plus petit incrément de charge (kg). */
  step: number;
}

export interface PlannedSet {
  weight: number;
  reps: number;
}

export interface PlannedExercise {
  slug: string;
  name: string;
  muscle: Muscle;
  equipment: Equipment;
  mechanic: Mechanic;
  step: number;
  repRange: [number, number];
  sets: PlannedSet[];
  reason: string;
  restSeconds: number;
}

export interface PlannedWorkout {
  name: string;
  focus: Focus;
  goal: Goal;
  duration: number;
  estimatedMin: number;
  exercises: PlannedExercise[];
}

export interface LoggedSet {
  weight: number;
  reps: number;
  rir: number;
}

export interface HistorySession {
  id: string;
  name: string;
  date: string; // ISO
  durationMin: number;
  volume: number;
  sets: number;
  prs: number;
  focus: Focus;
  goal: Goal;
  exercises: { slug: string; name: string; muscle: Muscle; sets: LoggedSet[] }[];
}

export const GOAL_LABEL: Record<Goal, string> = {
  masse: 'Prise de masse',
  affinement: 'Affinement',
  tonification: 'Tonification',
};

export const FOCUS_LABEL: Record<Focus, string> = {
  push: 'Push (pecs, épaules, triceps)',
  pull: 'Pull (dos, biceps)',
  legs: 'Jambes',
  upper: 'Haut du corps',
  lower: 'Bas du corps',
  full: 'Full body',
};

export const FOCUS_SHORT: Record<Focus, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Jambes',
  upper: 'Haut du corps',
  lower: 'Bas du corps',
  full: 'Full body',
};

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barre: 'Barre',
  halteres: 'Haltères',
  machine: 'Machine',
  poulie: 'Poulie',
  'poids-du-corps': 'Poids du corps',
};

const ex = (
  slug: string, name: string, muscle: Muscle, equipment: Equipment,
  mechanic: Mechanic, startKg: number, step: number
): Exercise => ({ slug, name, muscle, equipment, mechanic, startKg, step });

export const EXERCISES: Exercise[] = [
  // Pectoraux
  ex('developpe-couche-barre', 'Développé couché barre', 'pectoraux', 'barre', 'polyarticulaire', 50, 2.5),
  ex('developpe-incline-halteres', 'Développé incliné haltères', 'pectoraux', 'halteres', 'polyarticulaire', 18, 2),
  ex('developpe-machine-convergente', 'Développé machine convergente', 'pectoraux', 'machine', 'polyarticulaire', 40, 2.5),
  ex('pompes', 'Pompes', 'pectoraux', 'poids-du-corps', 'polyarticulaire', 0, 2.5),
  ex('pec-deck', 'Pec deck', 'pectoraux', 'machine', 'isolation', 35, 2.5),
  ex('ecarte-poulie-vis-a-vis', 'Écarté poulie vis-à-vis', 'pectoraux', 'poulie', 'isolation', 10, 2.5),
  // Dos
  ex('tractions', 'Tractions', 'dos', 'poids-du-corps', 'polyarticulaire', 0, 2.5),
  ex('rowing-barre', 'Rowing barre', 'dos', 'barre', 'polyarticulaire', 50, 2.5),
  ex('tirage-vertical', 'Tirage vertical', 'dos', 'poulie', 'polyarticulaire', 50, 2.5),
  ex('rowing-haltere-unilateral', 'Rowing haltère unilatéral', 'dos', 'halteres', 'polyarticulaire', 22, 2),
  ex('rowing-machine-assis', 'Rowing machine assis', 'dos', 'machine', 'polyarticulaire', 45, 2.5),
  ex('pull-over-poulie', 'Pull-over poulie', 'dos', 'poulie', 'isolation', 20, 2.5),
  // Épaules
  ex('developpe-militaire-barre', 'Développé militaire barre', 'epaules', 'barre', 'polyarticulaire', 35, 2.5),
  ex('developpe-epaules-halteres', 'Développé épaules haltères', 'epaules', 'halteres', 'polyarticulaire', 14, 2),
  ex('developpe-epaules-machine', 'Développé épaules machine', 'epaules', 'machine', 'polyarticulaire', 30, 2.5),
  ex('elevations-laterales-halteres', 'Élévations latérales haltères', 'epaules', 'halteres', 'isolation', 7, 1),
  ex('elevations-laterales-poulie', 'Élévations latérales poulie', 'epaules', 'poulie', 'isolation', 5, 1.25),
  ex('oiseau-machine', 'Oiseau machine', 'epaules', 'machine', 'isolation', 25, 2.5),
  // Biceps
  ex('curl-barre-ez', 'Curl barre EZ', 'biceps', 'barre', 'isolation', 25, 2.5),
  ex('curl-incline-halteres', 'Curl incliné haltères', 'biceps', 'halteres', 'isolation', 10, 1),
  ex('curl-marteau', 'Curl marteau', 'biceps', 'halteres', 'isolation', 12, 2),
  ex('curl-poulie', 'Curl poulie basse', 'biceps', 'poulie', 'isolation', 20, 2.5),
  // Triceps
  ex('barre-au-front', 'Barre au front', 'triceps', 'barre', 'isolation', 25, 2.5),
  ex('extension-poulie-corde', 'Extension triceps poulie corde', 'triceps', 'poulie', 'isolation', 25, 2.5),
  ex('dips', 'Dips', 'triceps', 'poids-du-corps', 'polyarticulaire', 0, 2.5),
  ex('extension-nuque-haltere', 'Extension nuque haltère', 'triceps', 'halteres', 'isolation', 14, 2),
  // Quadriceps
  ex('squat-barre', 'Squat barre', 'quadriceps', 'barre', 'polyarticulaire', 60, 2.5),
  ex('presse-a-cuisses', 'Presse à cuisses', 'quadriceps', 'machine', 'polyarticulaire', 100, 5),
  ex('hack-squat', 'Hack squat', 'quadriceps', 'machine', 'polyarticulaire', 60, 5),
  ex('goblet-squat', 'Goblet squat', 'quadriceps', 'halteres', 'polyarticulaire', 20, 2),
  ex('fentes-bulgares-halteres', 'Fentes bulgares haltères', 'quadriceps', 'halteres', 'polyarticulaire', 14, 2),
  ex('leg-extension', 'Leg extension', 'quadriceps', 'machine', 'isolation', 40, 2.5),
  // Ischios
  ex('souleve-de-terre-roumain', 'Soulevé de terre roumain', 'ischios', 'barre', 'polyarticulaire', 60, 2.5),
  ex('souleve-de-terre-roumain-halteres', 'Soulevé de terre roumain haltères', 'ischios', 'halteres', 'polyarticulaire', 20, 2),
  ex('leg-curl-allonge', 'Leg curl allongé', 'ischios', 'machine', 'isolation', 35, 2.5),
  ex('leg-curl-assis', 'Leg curl assis', 'ischios', 'machine', 'isolation', 35, 2.5),
  // Fessiers
  ex('hip-thrust-barre', 'Hip thrust barre', 'fessiers', 'barre', 'polyarticulaire', 60, 2.5),
  ex('hip-thrust-machine', 'Hip thrust machine', 'fessiers', 'machine', 'polyarticulaire', 60, 5),
  ex('kickback-poulie', 'Kickback poulie', 'fessiers', 'poulie', 'isolation', 15, 2.5),
  // Mollets
  ex('mollets-debout-machine', 'Mollets debout machine', 'mollets', 'machine', 'isolation', 60, 5),
  ex('mollets-presse', 'Mollets à la presse', 'mollets', 'machine', 'isolation', 80, 5),
  // Abdos
  ex('crunch-poulie', 'Crunch poulie haute', 'abdos', 'poulie', 'isolation', 30, 2.5),
  ex('releve-de-jambes', 'Relevé de jambes suspendu', 'abdos', 'poids-du-corps', 'isolation', 0, 2.5),
];

export const EXERCISE_BY_SLUG: Record<string, Exercise> = Object.fromEntries(
  EXERCISES.map((e) => [e.slug, e])
);

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

export function roundStep(value: number, step: number): number {
  if (step <= 0) return value;
  return Number((Math.round(value / step) * step).toFixed(2));
}

/** 1RM théorique (Epley) en tenant compte des reps en réserve : reps réelles = reps + RIR. */
export function epley1RM(weight: number, reps: number, rir = 0): number {
  if (weight <= 0 || reps <= 0) return 0;
  const effective = reps + Math.max(0, rir);
  if (effective <= 1) return weight;
  return Number((weight * (1 + effective / 30)).toFixed(1));
}

export function repRangeFor(goal: Goal, mechanic: Mechanic): [number, number] {
  const poly = mechanic === 'polyarticulaire';
  if (goal === 'masse') return poly ? [6, 10] : [10, 15];
  if (goal === 'affinement') return poly ? [8, 12] : [12, 15];
  return poly ? [10, 15] : [12, 20];
}

export function setsFor(goal: Goal, mechanic: Mechanic): number {
  if (goal === 'masse' && mechanic === 'polyarticulaire') return 4;
  return 3;
}

// ---------------------------------------------------------------------------
// 1. Surcharge progressive pilotée par le RIR
// ---------------------------------------------------------------------------

export interface NextTarget {
  weight: number;
  reps: number;
  reason: string;
}

/**
 * RIR 0  : échec -> on consolide (même charge, mêmes reps). Sous le bas de fourchette : -5 %.
 * RIR 1-2: zone optimale -> +1 rep ; en haut de fourchette -> +charge et retour au bas de fourchette.
 * RIR 3+ : trop facile -> +5 % (RIR 3) ou +10 % (RIR 4+), au moins un incrément.
 */
export function computeNextTarget(
  prev: LoggedSet,
  step: number,
  repRange: [number, number]
): NextTarget {
  const [min, max] = repRange;
  const { weight, reps } = prev;
  const rir = Math.max(0, prev.rir);
  const bodyweight = weight <= 0;
  const bump = (pct: number) => Math.max(step, roundStep(weight * pct, step));

  if (rir === 0) {
    if (reps < min) {
      const w = bodyweight ? 0 : roundStep(weight * 0.95, step);
      return { weight: w, reps: min, reason: 'Échec sous la fourchette : charge réduite de 5 %' };
    }
    return { weight, reps, reason: 'Échec atteint : on consolide la même charge' };
  }

  if (rir <= 2) {
    if (reps >= max) {
      return {
        weight: bodyweight ? step : Number((weight + bump(0.025)).toFixed(2)),
        reps: min,
        reason: 'Haut de fourchette atteint avec RIR optimal : on augmente la charge',
      };
    }
    return { weight, reps: reps + 1, reason: 'RIR optimal : +1 répétition' };
  }

  // RIR >= 3 : trop facile
  if (bodyweight) {
    return { weight: 0, reps: reps + 2, reason: 'Trop facile : +2 répétitions' };
  }
  const pct = rir >= 4 ? 0.1 : 0.05;
  return {
    weight: Number((weight + bump(pct)).toFixed(2)),
    reps: Math.min(Math.max(reps, min), max),
    reason: rir >= 4 ? 'Beaucoup trop facile : +10 % de charge' : 'Trop facile : +5 % de charge',
  };
}

// ---------------------------------------------------------------------------
// 2. Minuteur de repos dynamique
// ---------------------------------------------------------------------------

export function restSeconds(mechanic: Mechanic, rir: number | null, goal: Goal): number {
  let base = mechanic === 'polyarticulaire' ? 150 : 75;
  const r = rir ?? 2;
  if (r <= 0) base *= 1.4; // échec : récupération plus longue
  else if (r >= 3) base *= 0.7; // série facile : repos court
  if (goal === 'tonification') base *= 0.85;
  if (goal === 'affinement') base *= 0.9;
  return Math.min(300, Math.max(45, Math.round(base / 5) * 5));
}

// ---------------------------------------------------------------------------
// 3. Calculateur de plaques
// ---------------------------------------------------------------------------

export const BAR_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
export const DUMBBELL_PLATES = [10, 5, 2.5, 1.25, 0.5];

export interface PlateResult {
  valid: boolean;
  perSide: number;
  plates: number[];
  /** Charge totale non atteignable avec les plaques disponibles (kg). */
  remainder: number;
}

export function plateBreakdown(total: number, bar: number, available: number[] = BAR_PLATES): PlateResult {
  if (total < bar) return { valid: false, perSide: 0, plates: [], remainder: 0 };
  let perSide = (total - bar) / 2;
  const target = perSide;
  const plates: number[] = [];
  for (const p of [...available].sort((a, b) => b - a)) {
    while (perSide + 1e-9 >= p) {
      plates.push(p);
      perSide -= p;
    }
  }
  return { valid: true, perSide: target, plates, remainder: Number((perSide * 2).toFixed(2)) };
}

// ---------------------------------------------------------------------------
// 4. Génération de séance
// ---------------------------------------------------------------------------

const FOCUS_SLOTS: Record<Focus, Muscle[]> = {
  push: ['pectoraux', 'epaules', 'pectoraux', 'triceps', 'epaules', 'triceps'],
  pull: ['dos', 'dos', 'biceps', 'epaules', 'biceps', 'abdos'],
  legs: ['quadriceps', 'ischios', 'fessiers', 'quadriceps', 'mollets', 'ischios', 'abdos'],
  lower: ['quadriceps', 'ischios', 'fessiers', 'quadriceps', 'mollets', 'ischios', 'abdos'],
  upper: ['pectoraux', 'dos', 'epaules', 'biceps', 'triceps', 'pectoraux', 'dos'],
  full: ['quadriceps', 'pectoraux', 'dos', 'epaules', 'ischios', 'biceps', 'triceps'],
};

export const FOCUS_ROTATION: Focus[] = ['push', 'pull', 'legs'];

export function nextFocus(last?: Focus): Focus {
  if (!last) return 'push';
  const i = FOCUS_ROTATION.indexOf(last);
  if (i === -1) return 'push';
  return FOCUS_ROTATION[(i + 1) % FOCUS_ROTATION.length];
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function estimateSeconds(sets: number, mechanic: Mechanic, goal: Goal): number {
  return sets * (40 + restSeconds(mechanic, 2, goal)) + 60;
}

export interface GenerateOptions {
  focus: Focus;
  duration: number;
  goal: Goal;
  /** Historique, séance la plus récente en premier. */
  history?: HistorySession[];
  bodyWeightKg?: number;
  seed?: number;
}

export function generateWorkout(opts: GenerateOptions): PlannedWorkout {
  const { focus, duration, goal } = opts;
  const history = opts.history ?? [];
  const rand = mulberry32(opts.seed ?? Date.now());
  const bwRatio = Math.min(1.5, Math.max(0.6, (opts.bodyWeightKg ?? 75) / 75));

  // Pénalité de récence : plus l'exercice a été fait récemment, moins il est choisi.
  const recency = new Map<string, number>();
  history.slice(0, 3).forEach((s, idx) => {
    const penalty = idx === 0 ? 3 : idx === 1 ? 1.5 : 0.8;
    s.exercises.forEach((e) => recency.set(e.slug, Math.max(recency.get(e.slug) ?? 0, penalty)));
  });
  // Matériel utilisé lors de la dernière séance pour chaque muscle.
  const lastEquipmentByMuscle = new Map<Muscle, Equipment>();
  for (const s of history.slice(0, 2)) {
    for (const e of s.exercises) {
      const meta = EXERCISE_BY_SLUG[e.slug];
      if (meta && !lastEquipmentByMuscle.has(meta.muscle)) lastEquipmentByMuscle.set(meta.muscle, meta.equipment);
    }
  }

  const budget = duration * 60 - 180; // 3 min d'échauffement
  const chosen: Exercise[] = [];
  const seenMuscles = new Set<Muscle>();
  let used = 0;

  for (const muscle of FOCUS_SLOTS[focus]) {
    const wantPoly = !seenMuscles.has(muscle);
    const candidates = EXERCISES.filter((e) => e.muscle === muscle && !chosen.includes(e));
    if (candidates.length === 0) continue;

    const scored = candidates
      .map((e) => {
        let score = rand();
        score -= recency.get(e.slug) ?? 0;
        if (lastEquipmentByMuscle.get(muscle) === e.equipment) score -= 0.8;
        score -= chosen.filter((c) => c.equipment === e.equipment).length * 0.5;
        score += (e.mechanic === 'polyarticulaire') === wantPoly ? 2 : 0;
        return { e, score };
      })
      .sort((a, b) => b.score - a.score);

    const pick = scored[0].e;
    const cost = estimateSeconds(setsFor(goal, pick.mechanic), pick.mechanic, goal);
    if (used + cost > budget) continue;
    chosen.push(pick);
    seenMuscles.add(muscle);
    used += cost;
  }

  // Garantie minimale : au moins 2 exercices.
  if (chosen.length < 2) {
    for (const muscle of FOCUS_SLOTS[focus]) {
      const fallback = EXERCISES.find((e) => e.muscle === muscle && !chosen.includes(e) && e.mechanic === 'isolation');
      if (fallback) chosen.push(fallback);
      if (chosen.length >= 2) break;
    }
  }

  const exercises: PlannedExercise[] = chosen.map((e) => {
    const range = repRangeFor(goal, e.mechanic);
    const nSets = setsFor(goal, e.mechanic);
    const lastSets = findLastSets(history, e.slug);
    let reason: string;
    const sets: PlannedSet[] = [];

    if (lastSets && lastSets.length > 0) {
      let firstReason = '';
      for (let i = 0; i < nSets; i++) {
        const prev = lastSets[Math.min(i, lastSets.length - 1)];
        const t = computeNextTarget(prev, e.step, range);
        if (i === 0) firstReason = t.reason;
        sets.push({ weight: t.weight, reps: t.reps });
      }
      reason = firstReason;
    } else {
      const w = e.startKg === 0 ? 0 : Math.max(e.step, roundStep(e.startKg * bwRatio, e.step));
      for (let i = 0; i < nSets; i++) sets.push({ weight: w, reps: Math.min(range[1], range[0] + 1) });
      reason = 'Première fois : charge de départ estimée, vise RIR 2';
    }

    return {
      slug: e.slug,
      name: e.name,
      muscle: e.muscle,
      equipment: e.equipment,
      mechanic: e.mechanic,
      step: e.step,
      repRange: range,
      sets,
      reason,
      restSeconds: restSeconds(e.mechanic, 2, goal),
    };
  });

  return {
    name: `${FOCUS_SHORT[focus]} · ${GOAL_LABEL[goal]}`,
    focus,
    goal,
    duration,
    estimatedMin: Math.round((used + 180) / 60),
    exercises,
  };
}

function findLastSets(history: HistorySession[], slug: string): LoggedSet[] | null {
  for (const s of history) {
    const found = s.exercises.find((e) => e.slug === slug);
    if (found && found.sets.length > 0) return found.sets;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 5. Lecture d'une demande en langage naturel (Coach IA)
// ---------------------------------------------------------------------------

export const DURATIONS = [30, 45, 75] as const;

export interface CoachRequest {
  duration?: number;
  goal?: Goal;
  focus?: Focus;
}

export function parseCoachRequest(text: string): CoachRequest {
  const t = text.toLowerCase();
  const out: CoachRequest = {};

  let minutes: number | undefined;
  const hm = t.match(/(\d+)\s*h\s*(\d+)?/);
  if (hm) minutes = parseInt(hm[1], 10) * 60 + (hm[2] ? parseInt(hm[2], 10) : 0);
  else {
    const m = t.match(/(\d+)\s*(min|mn|minutes)/);
    if (m) minutes = parseInt(m[1], 10);
  }
  if (minutes) {
    out.duration = DURATIONS.reduce((best, d) => (Math.abs(d - minutes!) < Math.abs(best - minutes!) ? d : best), 45 as number);
  }

  if (/affin|sèche|seche|perte|définition|definition|minceur|gras/.test(t)) out.goal = 'affinement';
  else if (/tonif|toni|ferme/.test(t)) out.goal = 'tonification';
  else if (/mass|prise|volume|muscle|gros|hypertrophie/.test(t)) out.goal = 'masse';

  if (/haut du corps|upper/.test(t)) out.focus = 'upper';
  else if (/bas du corps|lower/.test(t)) out.focus = 'lower';
  else if (/full|complet|corps entier/.test(t)) out.focus = 'full';
  else if (/jambe|cuisse|legs|fessier|squat|quadri/.test(t)) out.focus = 'legs';
  else if (/dos|pull|tirage|biceps/.test(t)) out.focus = 'pull';
  else if (/pec|poitrine|push|pouss|épaule|epaule|triceps/.test(t)) out.focus = 'push';
  else if (/bras/.test(t)) out.focus = 'upper';

  return out;
}
