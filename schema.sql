-- FitPulse : schéma PostgreSQL / Supabase
-- À exécuter dans Supabase > SQL Editor

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  goal text not null default 'masse' check (goal in ('masse', 'affinement', 'tonification')),
  level text not null default 'intermediaire' check (level in ('debutant', 'intermediaire', 'avance')),
  weight_kg numeric(5,2),
  height_cm numeric(5,1),
  default_duration int not null default 45 check (default_duration in (30, 45, 75)),
  created_at timestamptz not null default now()
);

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- EXERCISES (catalogue partagé, lecture seule pour les utilisateurs)
-- ---------------------------------------------------------------
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  muscle_group text not null,
  equipment text not null check (equipment in ('barre', 'halteres', 'machine', 'poulie', 'poids-du-corps')),
  mechanic text not null check (mechanic in ('polyarticulaire', 'isolation')),
  step_kg numeric(4,2) not null default 2.5,
  created_at timestamptz not null default now()
);

insert into public.exercises (slug, name, muscle_group, equipment, mechanic, step_kg) values
  ('developpe-couche-barre', 'Développé couché barre', 'pectoraux', 'barre', 'polyarticulaire', 2.5),
  ('developpe-incline-halteres', 'Développé incliné haltères', 'pectoraux', 'halteres', 'polyarticulaire', 2),
  ('developpe-machine-convergente', 'Développé machine convergente', 'pectoraux', 'machine', 'polyarticulaire', 2.5),
  ('pompes', 'Pompes', 'pectoraux', 'poids-du-corps', 'polyarticulaire', 2.5),
  ('pec-deck', 'Pec deck', 'pectoraux', 'machine', 'isolation', 2.5),
  ('ecarte-poulie-vis-a-vis', 'Écarté poulie vis-à-vis', 'pectoraux', 'poulie', 'isolation', 2.5),
  ('tractions', 'Tractions', 'dos', 'poids-du-corps', 'polyarticulaire', 2.5),
  ('rowing-barre', 'Rowing barre', 'dos', 'barre', 'polyarticulaire', 2.5),
  ('tirage-vertical', 'Tirage vertical', 'dos', 'poulie', 'polyarticulaire', 2.5),
  ('rowing-haltere-unilateral', 'Rowing haltère unilatéral', 'dos', 'halteres', 'polyarticulaire', 2),
  ('rowing-machine-assis', 'Rowing machine assis', 'dos', 'machine', 'polyarticulaire', 2.5),
  ('pull-over-poulie', 'Pull-over poulie', 'dos', 'poulie', 'isolation', 2.5),
  ('developpe-militaire-barre', 'Développé militaire barre', 'epaules', 'barre', 'polyarticulaire', 2.5),
  ('developpe-epaules-halteres', 'Développé épaules haltères', 'epaules', 'halteres', 'polyarticulaire', 2),
  ('developpe-epaules-machine', 'Développé épaules machine', 'epaules', 'machine', 'polyarticulaire', 2.5),
  ('elevations-laterales-halteres', 'Élévations latérales haltères', 'epaules', 'halteres', 'isolation', 1),
  ('elevations-laterales-poulie', 'Élévations latérales poulie', 'epaules', 'poulie', 'isolation', 1.25),
  ('oiseau-machine', 'Oiseau machine', 'epaules', 'machine', 'isolation', 2.5),
  ('curl-barre-ez', 'Curl barre EZ', 'biceps', 'barre', 'isolation', 2.5),
  ('curl-incline-halteres', 'Curl incliné haltères', 'biceps', 'halteres', 'isolation', 1),
  ('curl-marteau', 'Curl marteau', 'biceps', 'halteres', 'isolation', 2),
  ('curl-poulie', 'Curl poulie basse', 'biceps', 'poulie', 'isolation', 2.5),
  ('barre-au-front', 'Barre au front', 'triceps', 'barre', 'isolation', 2.5),
  ('extension-poulie-corde', 'Extension triceps poulie corde', 'triceps', 'poulie', 'isolation', 2.5),
  ('dips', 'Dips', 'triceps', 'poids-du-corps', 'polyarticulaire', 2.5),
  ('extension-nuque-haltere', 'Extension nuque haltère', 'triceps', 'halteres', 'isolation', 2),
  ('squat-barre', 'Squat barre', 'quadriceps', 'barre', 'polyarticulaire', 2.5),
  ('presse-a-cuisses', 'Presse à cuisses', 'quadriceps', 'machine', 'polyarticulaire', 5),
  ('hack-squat', 'Hack squat', 'quadriceps', 'machine', 'polyarticulaire', 5),
  ('goblet-squat', 'Goblet squat', 'quadriceps', 'halteres', 'polyarticulaire', 2),
  ('fentes-bulgares-halteres', 'Fentes bulgares haltères', 'quadriceps', 'halteres', 'polyarticulaire', 2),
  ('leg-extension', 'Leg extension', 'quadriceps', 'machine', 'isolation', 2.5),
  ('souleve-de-terre-roumain', 'Soulevé de terre roumain', 'ischios', 'barre', 'polyarticulaire', 2.5),
  ('souleve-de-terre-roumain-halteres', 'Soulevé de terre roumain haltères', 'ischios', 'halteres', 'polyarticulaire', 2),
  ('leg-curl-allonge', 'Leg curl allongé', 'ischios', 'machine', 'isolation', 2.5),
  ('leg-curl-assis', 'Leg curl assis', 'ischios', 'machine', 'isolation', 2.5),
  ('hip-thrust-barre', 'Hip thrust barre', 'fessiers', 'barre', 'polyarticulaire', 2.5),
  ('hip-thrust-machine', 'Hip thrust machine', 'fessiers', 'machine', 'polyarticulaire', 5),
  ('kickback-poulie', 'Kickback poulie', 'fessiers', 'poulie', 'isolation', 2.5),
  ('mollets-debout-machine', 'Mollets debout machine', 'mollets', 'machine', 'isolation', 5),
  ('mollets-presse', 'Mollets à la presse', 'mollets', 'machine', 'isolation', 5),
  ('crunch-poulie', 'Crunch poulie haute', 'abdos', 'poulie', 'isolation', 2.5),
  ('releve-de-jambes', 'Relevé de jambes suspendu', 'abdos', 'poids-du-corps', 'isolation', 2.5)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------
-- WORKOUTS (une séance = une ligne)
-- ---------------------------------------------------------------
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  goal text,
  focus text,
  duration_target int,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  total_volume numeric(10,2) not null default 0,
  pr_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists workouts_user_started_idx on public.workouts (user_id, started_at desc);

-- ---------------------------------------------------------------
-- WORKOUT_LOGS (un exercice réalisé dans une séance)
-- ---------------------------------------------------------------
create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_slug text not null,
  exercise_name text not null,
  position int not null default 0
);
create index if not exists workout_logs_workout_idx on public.workout_logs (workout_id);
create index if not exists workout_logs_user_slug_idx on public.workout_logs (user_id, exercise_slug);

-- ---------------------------------------------------------------
-- SET_LOGS (une série)
-- ---------------------------------------------------------------
create table if not exists public.set_logs (
  id uuid primary key default gen_random_uuid(),
  workout_log_id uuid not null references public.workout_logs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  set_number int not null,
  weight_kg numeric(6,2) not null default 0,
  reps int not null default 0,
  rir int check (rir between 0 and 5),
  completed boolean not null default true,
  is_pr boolean not null default false,
  e1rm numeric(6,2) not null default 0
);
create index if not exists set_logs_log_idx on public.set_logs (workout_log_id);

-- ---------------------------------------------------------------
-- BODY_METRICS
-- ---------------------------------------------------------------
create table if not exists public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  weight_kg numeric(5,2) not null,
  body_fat_pct numeric(4,1),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ---------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_logs enable row level security;
alter table public.set_logs enable row level security;
alter table public.body_metrics enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "exercises_read_all" on public.exercises;
create policy "exercises_read_all" on public.exercises for select using (true);

drop policy if exists "workouts_all_own" on public.workouts;
create policy "workouts_all_own" on public.workouts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "workout_logs_all_own" on public.workout_logs;
create policy "workout_logs_all_own" on public.workout_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "set_logs_all_own" on public.set_logs;
create policy "set_logs_all_own" on public.set_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "body_metrics_all_own" on public.body_metrics;
create policy "body_metrics_all_own" on public.body_metrics for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
