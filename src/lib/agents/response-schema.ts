// ============================================================
// Agent Response Schema — Parse & Validate LLM Output
// ============================================================

import type { Direction } from "@/lib/types";

export interface AgentPostOutput {
  token_symbol: string;
  token_address: string;
  direction: Direction;
  confidence: number;
  evidence: string[];
  natural_text: string;
  reasoning: string;
  uncertainty: string;
  confidence_rationale: string;
}

const VALID_DIRECTIONS: Direction[] = ["bullish", "bearish", "neutral"];

export function parseAgentResponse(raw: string): AgentPostOutput {
  // Try to extract JSON from the response (handle markdown code blocks)
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
  const jsonStr = jsonMatch?.[1]?.trim() ?? raw.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Failed to parse LLM response as JSON: ${raw.slice(0, 200)}`);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("LLM response is not a JSON object");
  }

  const obj = parsed as Record<string, unknown>;

  // Validate required fields
  const tokenSymbol = typeof obj.token_symbol === "string" ? obj.token_symbol : "";
  const tokenAddress = typeof obj.token_address === "string" ? obj.token_address : "";
  const naturalText = typeof obj.natural_text === "string" ? obj.natural_text : "";

  if (!naturalText) {
    throw new Error("LLM response missing natural_text");
  }

  // Validate direction
  const direction = typeof obj.direction === "string" && VALID_DIRECTIONS.includes(obj.direction as Direction)
    ? (obj.direction as Direction)
    : "neutral";

  // Validate confidence (0-1)
  let confidence = typeof obj.confidence === "number" ? obj.confidence : 0.5;
  confidence = Math.max(0, Math.min(1, confidence));

  // Validate evidence array
  const evidence = Array.isArray(obj.evidence)
    ? obj.evidence.filter((e): e is string => typeof e === "string")
    : [];

  const reasoning = typeof obj.reasoning === "string" ? obj.reasoning : "";
  const uncertainty = typeof obj.uncertainty === "string" ? obj.uncertainty : "";
  const confidenceRationale = typeof obj.confidence_rationale === "string" ? obj.confidence_rationale : "";

  return {
    token_symbol: tokenSymbol,
    token_address: tokenAddress,
    direction,
    confidence,
    evidence,
    natural_text: naturalText,
    reasoning,
    uncertainty,
    confidence_rationale: confidenceRationale,
  };
}
