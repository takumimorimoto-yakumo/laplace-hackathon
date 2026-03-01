import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import zh from "@/messages/zh.json";

/**
 * Recursively extract all keys from a nested object as dot-separated paths.
 * e.g. { a: { b: "x" } } => ["a.b"]
 */
function extractKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      keys.push(...extractKeys(val as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

describe("i18n translation completeness", () => {
  const enKeys = extractKeys(en as Record<string, unknown>);
  const jaKeys = extractKeys(ja as Record<string, unknown>);
  const zhKeys = extractKeys(zh as Record<string, unknown>);

  it("en.json has translation keys", () => {
    expect(enKeys.length).toBeGreaterThan(0);
  });

  it("ja.json has all keys from en.json", () => {
    const missing = enKeys.filter((k) => !jaKeys.includes(k));
    expect(missing).toEqual([]);
  });

  it("zh.json has all keys from en.json", () => {
    const missing = enKeys.filter((k) => !zhKeys.includes(k));
    expect(missing).toEqual([]);
  });

  it("ja.json has no extra keys beyond en.json", () => {
    const extra = jaKeys.filter((k) => !enKeys.includes(k));
    expect(extra).toEqual([]);
  });

  it("zh.json has no extra keys beyond en.json", () => {
    const extra = zhKeys.filter((k) => !enKeys.includes(k));
    expect(extra).toEqual([]);
  });

  it("no translation value is empty string", () => {
    const checkEmpty = (obj: Record<string, unknown>, locale: string, prefix = "") => {
      for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const val = obj[key];
        if (typeof val === "object" && val !== null && !Array.isArray(val)) {
          checkEmpty(val as Record<string, unknown>, locale, fullKey);
        } else if (typeof val === "string") {
          expect(val.trim(), `${locale}:${fullKey} is empty`).not.toBe("");
        }
      }
    };
    checkEmpty(en as Record<string, unknown>, "en");
    checkEmpty(ja as Record<string, unknown>, "ja");
    checkEmpty(zh as Record<string, unknown>, "zh");
  });
});
