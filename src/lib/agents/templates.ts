// ============================================================
// Agent Templates — Adopt & Customize Presets
// ============================================================

import type {
  AgentTemplate,
  AgentStyle,
  AnalysisModule,
  LLMModel,
  VoiceStyle,
  InvestmentOutlook,
  AgentTimeHorizon,
  ReasoningStyle,
  RiskTolerance,
  AssetFocus,
} from "@/lib/types";

export interface TemplateConfig {
  style: AgentStyle;
  modules: AnalysisModule[];
  defaultLlm: LLMModel;
  temperature: number;
  personality: string;
  bio: string;
  voiceStyle: VoiceStyle;
  defaultOutlook: InvestmentOutlook;
  // New 7-axis fields
  timeHorizon: AgentTimeHorizon;
  reasoningStyle: ReasoningStyle;
  riskTolerance: RiskTolerance;
  assetFocus: AssetFocus;
}

export const FREE_LLMS: LLMModel[] = ["deepseek", "gemini-pro", "grok"];
export const PRO_LLMS: LLMModel[] = ["claude-sonnet", "gpt-4o"];
export const AVAILABLE_LLMS: LLMModel[] = [...FREE_LLMS, ...PRO_LLMS];

// ---------- Derivation Functions ----------

/** Derive LLM temperature from risk tolerance and reasoning style */
export function deriveTemperature(risk: RiskTolerance, reasoning: ReasoningStyle): number {
  const matrix: Record<RiskTolerance, Record<ReasoningStyle, number>> = {
    conservative: { momentum: 0.3, contrarian: 0.4, fundamental: 0.3, quantitative: 0.2, narrative: 0.4 },
    moderate:     { momentum: 0.5, contrarian: 0.5, fundamental: 0.4, quantitative: 0.3, narrative: 0.5 },
    aggressive:   { momentum: 0.7, contrarian: 0.6, fundamental: 0.5, quantitative: 0.4, narrative: 0.7 },
    degen:        { momentum: 0.8, contrarian: 0.7, fundamental: 0.6, quantitative: 0.5, narrative: 0.8 },
  };
  return matrix[risk][reasoning];
}

/** Derive cycle interval from time horizon (minutes between analysis cycles) */
export function deriveCycleInterval(horizon: AgentTimeHorizon): number {
  const map: Record<AgentTimeHorizon, number> = {
    scalp: 10,
    intraday: 15,
    swing: 20,
    position: 30,
    long_term: 60,
  };
  return map[horizon];
}

/** Convert reasoning style + risk to legacy AgentStyle for backward compat */
export function reasoningToLegacyStyle(reasoning: ReasoningStyle, risk: RiskTolerance): AgentStyle {
  if (risk === "degen") return "degen";
  if (reasoning === "contrarian") return "contrarian";
  if (reasoning === "momentum") return "daytrader";
  if (reasoning === "quantitative") return "quant";
  if (reasoning === "fundamental") return "macro";
  // narrative
  return "swing";
}

export const AGENT_TEMPLATES: Record<AgentTemplate, TemplateConfig> = {
  day_trader: {
    style: "daytrader",
    modules: ["technical", "onchain"],
    defaultLlm: "deepseek",
    temperature: 0.7,
    personality:
      "Fast-paced intraday trader who reacts to momentum and volume spikes. Goes long on strength, short on weakness.",
    bio: "Intraday momentum trader. Reads candles and volume in both directions. Quick entries, quick exits.",
    voiceStyle: "concise",
    defaultOutlook: "neutral",
    timeHorizon: "intraday",
    reasoningStyle: "momentum",
    riskTolerance: "aggressive",
    assetFocus: "broad",
  },
  swing_trader: {
    style: "swing",
    modules: ["technical", "defi"],
    defaultLlm: "deepseek",
    temperature: 0.5,
    personality:
      "Patient swing trader who combines technical setups with DeFi fundamentals. Targets moves over hours to days — long or short.",
    bio: "Swing trader blending technicals with DeFi insights. Captures multi-hour to multi-day moves in both directions.",
    voiceStyle: "analytical",
    defaultOutlook: "neutral",
    timeHorizon: "swing",
    reasoningStyle: "fundamental",
    riskTolerance: "moderate",
    assetFocus: "broad",
  },
  mid_term_investor: {
    style: "macro",
    modules: ["defi", "macro_regulatory"],
    defaultLlm: "deepseek",
    temperature: 0.4,
    personality:
      "Thoughtful mid-term analyst focused on DeFi fundamentals and macro trends. Bullish when metrics improve, bearish when they deteriorate.",
    bio: "Mid-term DeFi analyst. TVL flows, protocol economics, and macro shifts guide my calls over days to weeks.",
    voiceStyle: "structural",
    defaultOutlook: "neutral",
    timeHorizon: "position",
    reasoningStyle: "fundamental",
    riskTolerance: "moderate",
    assetFocus: "defi_tokens",
  },
  macro_strategist: {
    style: "macro",
    modules: ["macro_regulatory", "sentiment"],
    defaultLlm: "gpt-4o",
    temperature: 0.4,
    personality:
      "Big-picture macro strategist analyzing monetary policy, regulation, and sector rotation for crypto. Reads macro for direction — bullish or bearish.",
    bio: "Macro strategist. Fed policy, regulatory shifts, and capital flows shape my thesis over weeks to months.",
    voiceStyle: "structural",
    defaultOutlook: "neutral",
    timeHorizon: "long_term",
    reasoningStyle: "fundamental",
    riskTolerance: "conservative",
    assetFocus: "broad",
  },
  meme_hunter: {
    style: "degen",
    modules: ["sentiment", "onchain"],
    defaultLlm: "grok",
    temperature: 0.8,
    personality:
      "High-energy meme coin trader chasing asymmetric returns. Rides social momentum up and fades it down.",
    bio: "Degen meme trader. Social momentum works both ways — I ride the wave in either direction.",
    voiceStyle: "provocative",
    defaultOutlook: "neutral",
    timeHorizon: "scalp",
    reasoningStyle: "narrative",
    riskTolerance: "degen",
    assetFocus: "meme",
  },
  risk_analyst: {
    style: "macro",
    modules: ["risk", "defi"],
    defaultLlm: "deepseek",
    temperature: 0.3,
    personality:
      "Risk analyst who evaluates protocol risk, liquidity, and tail events. Identifies both underpriced risks and overpriced fears.",
    bio: "Risk-first analyst. I assess whether the market is over- or under-pricing risk.",
    voiceStyle: "analytical",
    defaultOutlook: "neutral",
    timeHorizon: "long_term",
    reasoningStyle: "fundamental",
    riskTolerance: "conservative",
    assetFocus: "broad",
  },
  defi_specialist: {
    style: "quant",
    modules: ["defi", "risk"],
    defaultLlm: "deepseek",
    temperature: 0.5,
    personality:
      "Data-driven DeFi specialist tracking TVL, yield, and protocol economics. Bullish when metrics grow, bearish when they contract.",
    bio: "Quant DeFi specialist. TVL flows, yield curves, and protocol metrics determine direction.",
    voiceStyle: "analytical",
    defaultOutlook: "neutral",
    timeHorizon: "swing",
    reasoningStyle: "quantitative",
    riskTolerance: "moderate",
    assetFocus: "defi_tokens",
  },
  contrarian: {
    style: "contrarian",
    modules: ["sentiment", "technical"],
    defaultLlm: "deepseek",
    temperature: 0.6,
    personality:
      "Contrarian thinker who takes the opposite side of crowded trades. Long during panic, short during euphoria.",
    bio: "Professional contrarian. When everyone agrees, I take the other side. The crowd is usually wrong at extremes.",
    voiceStyle: "provocative",
    defaultOutlook: "neutral",
    timeHorizon: "swing",
    reasoningStyle: "contrarian",
    riskTolerance: "moderate",
    assetFocus: "broad",
  },
};

export function getTemplateConfig(
  template: AgentTemplate
): TemplateConfig | undefined {
  return AGENT_TEMPLATES[template];
}

export function isFreeLlm(llm: LLMModel): boolean {
  return FREE_LLMS.includes(llm);
}

export const TEMPLATE_KEYS = Object.keys(AGENT_TEMPLATES) as AgentTemplate[];
