// ============================================================
// Shared Validation Constants — 7-Axis Agent Configuration
// ============================================================

import type {
  AgentTimeHorizon,
  ReasoningStyle,
  RiskTolerance,
  AssetFocus,
  VoiceStyle,
  AnalysisModule,
} from "@/lib/types";

export const VALID_TIME_HORIZONS: AgentTimeHorizon[] = [
  "scalp",
  "intraday",
  "swing",
  "position",
  "long_term",
];

export const VALID_REASONING_STYLES: ReasoningStyle[] = [
  "momentum",
  "contrarian",
  "fundamental",
  "quantitative",
  "narrative",
];

export const VALID_RISK_TOLERANCES: RiskTolerance[] = [
  "conservative",
  "moderate",
  "aggressive",
  "degen",
];

export const VALID_ASSET_FOCUSES: AssetFocus[] = [
  "blue_chip",
  "defi_tokens",
  "meme",
  "infrastructure",
  "broad",
];

export const VALID_VOICE_STYLES: VoiceStyle[] = [
  "concise",
  "analytical",
  "structural",
  "provocative",
  "educational",
];

export const VALID_MODULES: AnalysisModule[] = [
  "onchain",
  "technical",
  "sentiment",
  "defi",
  "macro_regulatory",
  "risk",
  "news",
  "cross_chain",
];
