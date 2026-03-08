import { describe, it, expect } from "vitest";
import {
  AGENT_TEMPLATES,
  getTemplateConfig,
  AVAILABLE_LLMS,
  TEMPLATE_KEYS,
} from "../agents/templates";
import type { AgentTemplate } from "../types";

const ALL_TEMPLATES: AgentTemplate[] = [
  "day_trader",
  "swing_trader",
  "mid_term_investor",
  "macro_strategist",
  "meme_hunter",
  "risk_analyst",
  "defi_specialist",
  "contrarian",
];

describe("AGENT_TEMPLATES", () => {
  it("contains all 8 templates", () => {
    expect(Object.keys(AGENT_TEMPLATES)).toHaveLength(8);
  });

  it("has every expected template key", () => {
    for (const key of ALL_TEMPLATES) {
      expect(AGENT_TEMPLATES).toHaveProperty(key);
    }
  });

  it("TEMPLATE_KEYS matches all template type values", () => {
    expect(TEMPLATE_KEYS.sort()).toEqual([...ALL_TEMPLATES].sort());
  });

  it.each(ALL_TEMPLATES)("template '%s' has valid style", (key) => {
    const config = AGENT_TEMPLATES[key];
    const validStyles = ["swing", "daytrader", "macro", "contrarian", "quant", "degen"];
    expect(validStyles).toContain(config.style);
  });

  it.each(ALL_TEMPLATES)("template '%s' has non-empty modules array", (key) => {
    const config = AGENT_TEMPLATES[key];
    expect(Array.isArray(config.modules)).toBe(true);
    expect(config.modules.length).toBeGreaterThan(0);
  });

  it.each(ALL_TEMPLATES)("template '%s' has valid defaultLlm", (key) => {
    const config = AGENT_TEMPLATES[key];
    expect(AVAILABLE_LLMS).toContain(config.defaultLlm);
  });

  it.each(ALL_TEMPLATES)(
    "template '%s' has temperature between 0 and 1",
    (key) => {
      const config = AGENT_TEMPLATES[key];
      expect(config.temperature).toBeGreaterThanOrEqual(0);
      expect(config.temperature).toBeLessThanOrEqual(1);
    }
  );

  it.each(ALL_TEMPLATES)("template '%s' has non-empty personality", (key) => {
    const config = AGENT_TEMPLATES[key];
    expect(config.personality.length).toBeGreaterThan(0);
  });

  it.each(ALL_TEMPLATES)("template '%s' has non-empty bio", (key) => {
    const config = AGENT_TEMPLATES[key];
    expect(config.bio.length).toBeGreaterThan(0);
  });

  it.each(ALL_TEMPLATES)("template '%s' has valid voiceStyle", (key) => {
    const config = AGENT_TEMPLATES[key];
    const validVoiceStyles = ["concise", "analytical", "structural", "provocative"];
    expect(validVoiceStyles).toContain(config.voiceStyle);
  });

  it.each(ALL_TEMPLATES)("template '%s' has valid defaultOutlook", (key) => {
    const config = AGENT_TEMPLATES[key];
    const validOutlooks = ["ultra_bullish", "bullish", "bearish", "ultra_bearish"];
    expect(validOutlooks).toContain(config.defaultOutlook);
  });
});

describe("getTemplateConfig", () => {
  it("returns config for a valid template", () => {
    const config = getTemplateConfig("day_trader");
    expect(config).toBeDefined();
    expect(config?.style).toBe("daytrader");
  });

  it("returns undefined for an invalid template", () => {
    const config = getTemplateConfig("nonexistent" as AgentTemplate);
    expect(config).toBeUndefined();
  });

  it("returns the same reference as AGENT_TEMPLATES", () => {
    const config = getTemplateConfig("meme_hunter");
    expect(config).toBe(AGENT_TEMPLATES.meme_hunter);
  });
});
