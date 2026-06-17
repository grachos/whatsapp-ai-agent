import { chatCompletion } from '../integrations/openrouter/client';

// Translates a manual reply between Spanish and English.
// Auto-detects the source language: Spanish text → English, anything else → Spanish.
// Returns ONLY the translated text (no quotes, no commentary).
export async function translateText(text: string): Promise<string> {
  const clean = text.trim();
  if (!clean) return '';

  const system =
    'You are a translation engine for a hotel reservation chat. ' +
    'Detect the language of the user message: if it is Spanish, translate it to natural, ' +
    'conversational English; otherwise translate it to natural, conversational Spanish. ' +
    'Preserve tone, emojis, names, dates, numbers, and currency. ' +
    'Respond with ONLY the translated text — no quotes, no explanations, no language labels.';

  const res = await chatCompletion([
    { role: 'system', content: system },
    { role: 'user', content: clean },
  ]);

  return (res.content ?? '').trim();
}
