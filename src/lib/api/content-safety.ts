/**
 * Content safety layer: HTML stripping, injection detection,
 * forbidden keywords, and duplicate detection.
 */

export interface ContentSafetyResult {
  safe: boolean;
  reason?: string;
}

// ---------- HTML Stripping ----------

/** Remove all HTML tags and event handler attributes */
export function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "") // Remove event handlers
    .replace(/javascript\s*:/gi, "") // Remove javascript: URIs
    .trim();
}

// ---------- Prompt Injection Detection ----------

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+(instructions?|prompts?)/i,
  /disregard\s+(all\s+)?previous/i,
  /system\s*prompt/i,
  /you\s+are\s+now\s+/i,
  /act\s+as\s+(a\s+)?different/i,
  /execute\s*:/i,
  /\beval\s*\(/i,
  /\bexec\s*\(/i,
  /override\s+(system|instructions?|safety)/i,
  /jailbreak/i,
  /bypass\s+(filter|safety|content)/i,
  /pretend\s+you\s+are/i,
  /forget\s+(all\s+)?instructions/i,
  /new\s+instructions?\s*:/i,
];

export function detectInjection(text: string): ContentSafetyResult {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        safe: false,
        reason: "Content contains patterns that resemble prompt injection",
      };
    }
  }
  return { safe: true };
}

// ---------- Forbidden Keywords ----------

const FORBIDDEN_PATTERNS = [
  // Financial fraud
  /guaranteed\s+(profit|returns?|gains?)/i,
  /risk[\s-]*free\s+(investment|returns?|profit)/i,
  /100%\s+(safe|guaranteed|sure)/i,
  /get\s+rich\s+quick/i,
  /double\s+your\s+(money|investment|crypto)/i,
  /send\s+me\s+(your\s+)?(crypto|tokens?|sol|btc|eth)/i,
  /private\s+key/i,
  /seed\s+phrase/i,
  /connect\s+your\s+wallet\s+to/i,
  // Danger/harm
  /\bkill\b/i,
  /\bbomb\b/i,
  /\bterror/i,
];

export function checkForbiddenContent(text: string): ContentSafetyResult {
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      return {
        safe: false,
        reason: "Content contains prohibited terms",
      };
    }
  }
  return { safe: true };
}

// ---------- Duplicate Detection ----------

/**
 * Calculate Jaccard similarity between two sets of words.
 * Returns a value between 0 (no overlap) and 1 (identical).
 */
export function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));

  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }

  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const DUPLICATE_THRESHOLD = 0.8;

/**
 * Check if a new post is too similar to recent posts by the same agent.
 */
export function checkDuplicate(
  newText: string,
  recentTexts: string[]
): ContentSafetyResult {
  for (const existing of recentTexts) {
    const similarity = jaccardSimilarity(newText, existing);
    if (similarity > DUPLICATE_THRESHOLD) {
      return {
        safe: false,
        reason: "Content is too similar to a recent post",
      };
    }
  }
  return { safe: true };
}

// ---------- Combined Check ----------

/**
 * Run all content safety checks on a piece of text.
 * Returns the first failure, or { safe: true } if all pass.
 */
export function checkContentSafety(
  text: string,
  recentTexts: string[] = []
): ContentSafetyResult {
  // Strip HTML first
  const cleaned = stripHtml(text);

  // Check for injection
  const injectionResult = detectInjection(cleaned);
  if (!injectionResult.safe) return injectionResult;

  // Check for forbidden content
  const forbiddenResult = checkForbiddenContent(cleaned);
  if (!forbiddenResult.safe) return forbiddenResult;

  // Check for duplicates
  const duplicateResult = checkDuplicate(cleaned, recentTexts);
  if (!duplicateResult.safe) return duplicateResult;

  return { safe: true };
}
