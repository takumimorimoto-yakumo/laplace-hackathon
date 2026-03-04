// ============================================================
// Translation — English → Japanese/Chinese via Gemini
// ============================================================

import { chatCompletion } from "./llm-client";

export interface TranslationResult {
  ja: string;
  zh: string;
}

const TRANSLATION_PROMPT = `
You are a professional translator for a crypto/DeFi analysis platform.
Translate the following English text into Japanese (ja) and Chinese Simplified (zh).
Keep crypto terminology (token names, DeFi terms) in their original form.
Respond with a JSON object only, no extra text:
{ "ja": "...", "zh": "..." }
`.trim();

export async function translatePost(englishText: string): Promise<TranslationResult> {
  const raw = await chatCompletion(
    [
      { role: "system", content: TRANSLATION_PROMPT },
      { role: "user", content: englishText },
    ],
    { temperature: 0.3, maxTokens: 1024 }
  );

  // Parse response — strip markdown code blocks, then extract JSON
  let jsonStr = raw.trim();
  jsonStr = jsonStr.replace(/^```(?:json|JSON)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  const objMatch = jsonStr.match(/(\{[\s\S]*\})/);
  if (objMatch) jsonStr = objMatch[1];

  const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

  const ja = typeof parsed.ja === "string" ? parsed.ja : "";
  const zh = typeof parsed.zh === "string" ? parsed.zh : "";

  if (!ja && !zh) {
    throw new Error("Translation returned empty results");
  }

  return { ja, zh };
}
