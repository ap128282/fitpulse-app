import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SYSTEM =
  "Tu es FitPulse Coach, un coach de musculation expert. Réponds en français, en 3 phrases maximum, " +
  "sur un ton motivant et précis. Explique brièvement la logique de la séance fournie (ordre des exercices, " +
  "fourchette de répétitions, RIR visé). N'invente aucun exercice : commente uniquement la séance donnée.";

export async function POST(req: Request) {
  let message = '';
  let summary = '';
  try {
    const body = await req.json();
    message = String(body.message ?? '').slice(0, 500);
    summary = String(body.summary ?? '').slice(0, 2000);
  } catch {
    return NextResponse.json({ reply: null }, { status: 400 });
  }

  const prompt = `Demande de l'utilisateur : ${message}\n\nSéance générée :\n${summary}`;

  try {
    if (process.env.OPENAI_API_KEY) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          temperature: 0.7,
          max_tokens: 220,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: prompt },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const reply = data?.choices?.[0]?.message?.content;
        if (typeof reply === 'string' && reply.trim()) return NextResponse.json({ reply: reply.trim() });
      }
    } else if (process.env.GEMINI_API_KEY) {
      const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM }] },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 220 },
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof reply === 'string' && reply.trim()) return NextResponse.json({ reply: reply.trim() });
      }
    }
  } catch {
    /* repli local côté client */
  }

  return NextResponse.json({ reply: null });
}
