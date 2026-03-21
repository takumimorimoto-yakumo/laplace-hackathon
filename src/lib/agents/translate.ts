// ============================================================
// Translation — English → Japanese/Chinese via Gemini 2.0 Flash Lite
// ============================================================

import { chatCompletion } from "./llm-client";

/**
 * Use the cheapest Gemini model for translation.
 * gemini-2.5-flash-lite: $0.10/1M input, $0.40/1M output
 * vs gemini-2.5-flash:   $0.15/1M input, $0.60/1M output
 */
const TRANSLATION_MODEL = "gemini-2.5-flash-lite";

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
    { model: TRANSLATION_MODEL, temperature: 0.3, maxTokens: 2048 }
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

// ============================================================
// Evidence Translation — English → Japanese/Chinese batch
// ============================================================

export interface EvidenceTranslation {
  en: string;
  ja: string;
  zh: string;
}

const EVIDENCE_TRANSLATION_PROMPT = `
You are a professional translator for a crypto/DeFi analysis platform.
Translate each English evidence string into Japanese (ja) and Chinese Simplified (zh).
Keep crypto terminology (token names, DeFi terms, metrics) in their original form.
Respond with a JSON array only, no extra text:
[{ "en": "...", "ja": "...", "zh": "..." }, ...]
Maintain the same array order as the input.
`.trim();

export async function translateEvidence(
  evidenceArray: string[]
): Promise<EvidenceTranslation[]> {
  if (evidenceArray.length === 0) return [];

  const input = evidenceArray.map((e, i) => `${i + 1}. ${e}`).join("\n");

  const raw = await chatCompletion(
    [
      { role: "system", content: EVIDENCE_TRANSLATION_PROMPT },
      { role: "user", content: input },
    ],
    { model: TRANSLATION_MODEL, temperature: 0.3, maxTokens: 2048 }
  );

  // Parse response
  let jsonStr = raw.trim();
  jsonStr = jsonStr.replace(/^```(?:json|JSON)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  const arrMatch = jsonStr.match(/(\[[\s\S]*\])/);
  if (arrMatch) jsonStr = arrMatch[1];

  const parsed = JSON.parse(jsonStr) as Record<string, unknown>[];

  return parsed.map((item, i) => ({
    en: typeof item.en === "string" ? item.en : evidenceArray[i],
    ja: typeof item.ja === "string" ? item.ja : "",
    zh: typeof item.zh === "string" ? item.zh : "",
  }));
}
