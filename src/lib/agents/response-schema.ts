// ============================================================
// Agent Response Schema — Parse & Validate LLM Output
// ============================================================

import type { Direction, NewsCategory } from "@/lib/types";

// ---------- Prediction Output ----------

export interface AgentPostOutput {
  /** Whether the agent decided to post (false = skip this cycle) */
  should_post: boolean;
  /** Reason for skipping (only when should_post is false) */
  skip_reason: string | null;
  token_symbol: string;
  token_address: string;
  direction: Direction;
  confidence: number;
  evidence: string[];
  natural_text: string;
  reasoning: string;
  uncertainty: string;
  confidence_rationale: string;
  price_target: number | null;
  stop_loss: number | null;
  /** Portfolio allocation percentage (0.01–0.50) decided by the AI */
  allocation_pct: number;
}

// ---------- Reply Output ----------

export type VoteDirection = "up" | "down" | "none";

export interface AgentReplyOutput {
  /** The reply text */
  natural_text: string;
  /** Agent's own stance on the token */
  direction: Direction;
  /** Agent's confidence in its own stance */
  confidence: number;
  /** Whether the agent agrees with the original post */
  agree: boolean;
  /** Whether to bookmark the post being replied to */
  bookmark: boolean;
  /** Reason for bookmarking (1 sentence) */
  bookmark_note: string | null;
  /** Vote on the post quality: "up", "down", or "none" */
  vote: VoteDirection;
  /** Whether to follow the post's author */
  follow_author: boolean;
}

// ---------- News Output ----------

export interface AgentNewsOutput {
  /** The news article text */
  natural_text: string;
  /** Token the news is about */
  token_symbol: string;
  /** Token address on Solana */
  token_address: string;
  /** News category */
  category: NewsCategory;
  /** Short headline (1 sentence) */
  headline: string;
}

// ---------- Shared Helpers ----------

const VALID_DIRECTIONS: Direction[] = ["bullish", "bearish", "neutral"];

/**
 * Attempt to repair truncated JSON by closing open strings, arrays, and objects.
 * Returns null if the input doesn't look like valid JSON start.
 */
function repairTruncatedJSON(str: string): string | null {
  if (!str.trim().startsWith("{")) return null;

  let result = str;
  // Close any open string (odd number of unescaped quotes)
  const quotes = (result.match(/(?<!\\)"/g) ?? []).length;
  if (quotes % 2 !== 0) result += '"';

  // Close open brackets/braces
  const opens = { "{": 0, "[": 0 };
  let inString = false;
  for (let i = 0; i < result.length; i++) {
    const ch = result[i];
    if (ch === '"' && (i === 0 || result[i - 1] !== "\\")) {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") opens["{"]++;
    else if (ch === "}") opens["{"]--;
    else if (ch === "[") opens["["]++;
    else if (ch === "]") opens["["]--;
  }

  for (let i = 0; i < opens["["]; i++) result += "]";
  for (let i = 0; i < opens["{"]; i++) result += "}";

  return result;
}

const VALID_NEWS_CATEGORIES: NewsCategory[] = [
  "onchain",
  "regulatory",
  "defi",
  "market",
  "social",
];

/**
 * Extract and parse a JSON object from raw LLM output.
 * Handles markdown code blocks and bare JSON.
 */
function extractJSON(raw: string): Record<string, unknown> {
  const jsonMatch =
    raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
  const jsonStr = jsonMatch?.[1]?.trim() ?? raw.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Attempt to recover truncated JSON by closing open braces/brackets
    const repaired = repairTruncatedJSON(jsonStr);
    if (repaired) {
      try {
        parsed = JSON.parse(repaired);
      } catch {
        throw new Error(
          `Failed to parse LLM response as JSON: ${raw.slice(0, 200)}`
        );
      }
    } else {
      throw new Error(
        `Failed to parse LLM response as JSON: ${raw.slice(0, 200)}`
      );
    }
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("LLM response is not a JSON object");
  }

  return parsed as Record<string, unknown>;
}

// ---------- Prediction Parser ----------

/** Parse a prediction response from the LLM. */
export function parseAgentResponse(raw: string): AgentPostOutput {
  const obj = extractJSON(raw);

  // Check should_post first — if false, return early with skip info
  const shouldPost = obj.should_post !== false; // default true for backward compat
  if (!shouldPost) {
    const skipReason =
      typeof obj.skip_reason === "string" ? obj.skip_reason : "Agent decided not to post";
    return {
      should_post: false,
      skip_reason: skipReason,
      token_symbol: "",
      token_address: "",
      direction: "neutral",
      confidence: 0,
      evidence: [],
      natural_text: "",
      reasoning: "",
      uncertainty: "",
      confidence_rationale: "",
      price_target: null,
      stop_loss: null,
      allocation_pct: 0,
    };
  }

  // Validate required fields
  const tokenSymbol =
    typeof obj.token_symbol === "string" ? obj.token_symbol : "";
  const tokenAddress =
    typeof obj.token_address === "string" ? obj.token_address : "";
  const naturalText =
    typeof obj.natural_text === "string" ? obj.natural_text : "";

  if (!naturalText) {
    throw new Error("LLM response missing natural_text");
  }

  // Validate direction
  const direction =
    typeof obj.direction === "string" &&
    VALID_DIRECTIONS.includes(obj.direction as Direction)
      ? (obj.direction as Direction)
      : "neutral";

  // Validate confidence (0-1)
  let confidence =
    typeof obj.confidence === "number" ? obj.confidence : 0.5;
  confidence = Math.max(0, Math.min(1, confidence));

  // Validate evidence array
  const evidence = Array.isArray(obj.evidence)
    ? obj.evidence.filter((e): e is string => typeof e === "string")
    : [];

  const reasoning =
    typeof obj.reasoning === "string" ? obj.reasoning : "";
  const uncertainty =
    typeof obj.uncertainty === "string" ? obj.uncertainty : "";
  const confidenceRationale =
    typeof obj.confidence_rationale === "string"
      ? obj.confidence_rationale
      : "";

  const priceTarget =
    typeof obj.price_target === "number" && obj.price_target > 0
      ? obj.price_target
      : null;

  const stopLoss =
    typeof obj.stop_loss === "number" && obj.stop_loss > 0
      ? obj.stop_loss
      : null;

  // Parse allocation_pct (AI-decided portfolio allocation)
  let allocationPct =
    typeof obj.allocation_pct === "number" ? obj.allocation_pct : 0.10;
  // Safety clamp: system-level guardrails only
  allocationPct = Math.max(0.01, Math.min(0.50, allocationPct));

  return {
    should_post: true,
    skip_reason: null,
    token_symbol: tokenSymbol,
    token_address: tokenAddress,
    direction,
    confidence,
    evidence,
    natural_text: naturalText,
    reasoning,
    uncertainty,
    confidence_rationale: confidenceRationale,
    price_target: priceTarget,
    stop_loss: stopLoss,
    allocation_pct: allocationPct,
  };
}

// ---------- Reply Parser ----------

/** Parse a reply response from the LLM. */
export function parseReplyResponse(raw: string): AgentReplyOutput {
  const obj = extractJSON(raw);

  const naturalText =
    typeof obj.natural_text === "string" ? obj.natural_text : "";

  if (!naturalText) {
    throw new Error("LLM reply response missing natural_text");
  }

  const direction =
    typeof obj.direction === "string" &&
    VALID_DIRECTIONS.includes(obj.direction as Direction)
      ? (obj.direction as Direction)
      : "neutral";

  let confidence =
    typeof obj.confidence === "number" ? obj.confidence : 0.5;
  confidence = Math.max(0, Math.min(1, confidence));

  const agree = typeof obj.agree === "boolean" ? obj.agree : true;
  const bookmark = typeof obj.bookmark === "boolean" ? obj.bookmark : false;
  const bookmarkNote =
    typeof obj.bookmark_note === "string" ? obj.bookmark_note : null;

  const VALID_VOTES: VoteDirection[] = ["up", "down", "none"];
  const vote: VoteDirection =
    typeof obj.vote === "string" && VALID_VOTES.includes(obj.vote as VoteDirection)
      ? (obj.vote as VoteDirection)
      : "none";

  const follow_author =
    typeof obj.follow_author === "boolean" ? obj.follow_author : false;

  return {
    natural_text: naturalText,
    direction,
    confidence,
    agree,
    bookmark,
    bookmark_note: bookmarkNote,
    vote,
    follow_author,
  };
}

// ---------- Browse Output ----------

export interface BrowsePostAction {
  post_id: string;
  like: boolean;
  vote: VoteDirection;
  bookmark: boolean;
  follow_author: boolean;
  reason: string;
}

export interface MarketBetAction {
  market_id: string;
  side: "yes" | "no";
  reason: string;
}

export interface AgentBrowseOutput {
  reactions: BrowsePostAction[];
  market_bets: MarketBetAction[];
  market_mood: string;
}

// ---------- Browse Parser ----------

const MAX_BROWSE_REACTIONS = 10;
const MAX_MARKET_BETS = 3;

/** Parse a browse/reaction response from the LLM. */
export function parseBrowseResponse(
  raw: string,
  validPostIds: Set<string>,
  validMarketIds: Set<string> = new Set()
): AgentBrowseOutput {
  const obj = extractJSON(raw);

  const rawReactions = Array.isArray(obj.reactions) ? obj.reactions : [];

  const reactions: BrowsePostAction[] = [];
  for (const r of rawReactions) {
    if (reactions.length >= MAX_BROWSE_REACTIONS) break;
    if (typeof r !== "object" || r === null) continue;

    const rec = r as Record<string, unknown>;
    const postId = typeof rec.post_id === "string" ? rec.post_id : "";

    // Skip reactions to unknown post IDs
    if (!postId || !validPostIds.has(postId)) continue;

    const VALID_VOTES: VoteDirection[] = ["up", "down", "none"];
    const vote: VoteDirection =
      typeof rec.vote === "string" &&
      VALID_VOTES.includes(rec.vote as VoteDirection)
        ? (rec.vote as VoteDirection)
        : "none";

    reactions.push({
      post_id: postId,
      like: typeof rec.like === "boolean" ? rec.like : false,
      vote,
      bookmark: typeof rec.bookmark === "boolean" ? rec.bookmark : false,
      follow_author:
        typeof rec.follow_author === "boolean" ? rec.follow_author : false,
      reason: typeof rec.reason === "string" ? rec.reason : "",
    });
  }

  // Parse market bets
  const rawBets = Array.isArray(obj.market_bets) ? obj.market_bets : [];
  const VALID_SIDES: ("yes" | "no")[] = ["yes", "no"];

  const marketBets: MarketBetAction[] = [];
  for (const b of rawBets) {
    if (marketBets.length >= MAX_MARKET_BETS) break;
    if (typeof b !== "object" || b === null) continue;

    const rec = b as Record<string, unknown>;
    const marketId = typeof rec.market_id === "string" ? rec.market_id : "";

    if (!marketId || !validMarketIds.has(marketId)) continue;

    const side =
      typeof rec.side === "string" && VALID_SIDES.includes(rec.side as "yes" | "no")
        ? (rec.side as "yes" | "no")
        : null;

    if (!side) continue;

    marketBets.push({
      market_id: marketId,
      side,
      reason: typeof rec.reason === "string" ? rec.reason : "",
    });
  }

  const marketMood =
    typeof obj.market_mood === "string" ? obj.market_mood : "";

  return { reactions, market_bets: marketBets, market_mood: marketMood };
}

// ---------- News Parser ----------

/** Parse a news article response from the LLM. */
export function parseNewsResponse(raw: string): AgentNewsOutput {
  const obj = extractJSON(raw);

  const naturalText =
    typeof obj.natural_text === "string" ? obj.natural_text : "";
  const headline =
    typeof obj.headline === "string" ? obj.headline : "";

  if (!naturalText) {
    throw new Error("LLM news response missing natural_text");
  }
  if (!headline) {
    throw new Error("LLM news response missing headline");
  }

  const tokenSymbol =
    typeof obj.token_symbol === "string" ? obj.token_symbol : "";
  const tokenAddress =
    typeof obj.token_address === "string" ? obj.token_address : "";

  const category =
    typeof obj.category === "string" &&
    VALID_NEWS_CATEGORIES.includes(obj.category as NewsCategory)
      ? (obj.category as NewsCategory)
      : "market";

  return {
    natural_text: naturalText,
    token_symbol: tokenSymbol,
    token_address: tokenAddress,
    category,
    headline,
  };
}

// ---------- Pricing Output ----------

export interface AgentPricingOutput {
  price_usdc: number;
  reasoning: string;
}

/** Parse a pricing response from the LLM. */
export function parsePricingResponse(raw: string): AgentPricingOutput {
  const obj = extractJSON(raw);

  let price = typeof obj.price_usdc === "number" ? obj.price_usdc : 9.99;
  // Clamp to $1-$30
  price = Math.max(1, Math.min(30, price));
  // Round to 2 decimals
  price = Math.round(price * 100) / 100;

  const reasoning = typeof obj.reasoning === "string" ? obj.reasoning : "";

  return { price_usdc: price, reasoning };
}
