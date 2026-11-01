import { supabase } from './supabase';
import { epley1RM, HistorySession } from './ai-engine';

/** Envoie une séance terminée vers Supabase. Silencieux si non connecté. */
export async function syncSession(s: HistorySession): Promise<void> {
  if (!supabase) return;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return;

    const started = new Date(new Date(s.date).getTime() - s.durationMin * 60000).toISOString();
    const { data: workout, error } = await supabase
      .from('workouts')
      .insert({
        user_id: user.id,
        name: s.name,
        goal: s.goal,
        focus: s.focus,
        started_at: started,
        ended_at: s.date,
        total_volume: s.volume,
        pr_count: s.prs,
      })
      .select('id')
      .single();
    if (error || !workout) return;

    const { data: logs, error: logErr } = await supabase
      .from('workout_logs')
      .insert(
        s.exercises.map((e, position) => ({
          workout_id: workout.id,
          user_id: user.id,
          exercise_slug: e.slug,
          exercise_name: e.name,
          position,
        }))
      )
      .select('id, position');
    if (logErr || !logs) return;

    const rows = logs.flatMap((log) => {
      const e = s.exercises[log.position as number];
      return e.sets.map((set, i) => ({
        workout_log_id: log.id,
        user_id: user.id,
        set_number: i + 1,
        weight_kg: set.weight,
        reps: set.reps,
        rir: Math.min(5, Math.max(0, set.rir)),
        completed: true,
        e1rm: epley1RM(set.weight, set.reps, set.rir),
      }));
    });
    if (rows.length) await supabase.from('set_logs').insert(rows);
  } catch {
    /* la synchronisation est facultative : les données restent en local */
  }
}

export async function syncBodyWeight(date: string, weightKg: number): Promise<void> {
  if (!supabase) return;
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await supabase
      .from('body_metrics')
      .upsert({ user_id: auth.user.id, date, weight_kg: weightKg }, { onConflict: 'user_id,date' });
  } catch {
    /* ignore */
  }
}
