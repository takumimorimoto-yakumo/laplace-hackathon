import { describe, it, expect } from "vitest";
import {
  parseAgentResponse,
  parseReplyResponse,
  parseBrowseResponse,
  parseNewsResponse,
  parsePricingResponse,
} from "@/lib/agents/response-schema";

// ============================================================
// JSON Extraction helpers (tested indirectly via parsers)
// ============================================================

describe("JSON extraction", () => {
  it("parses bare JSON object", () => {
    const raw = JSON.stringify({
      natural_text: "SOL looks strong",
      direction: "bullish",
      confidence: 0.8,
      token_symbol: "SOL",
      token_address: "So11111111111111111111111111111111111111112",
      evidence: ["TVL up"],
      reasoning: "reason",
      uncertainty: "none",
      confidence_rationale: "high",
    });
    const result = parseAgentResponse(raw);
    expect(result.natural_text).toBe("SOL looks strong");
  });

  it("extracts JSON from ```json code block", () => {
    const raw = `Here is my analysis:\n\`\`\`json\n${JSON.stringify({
      natural_text: "From code block",
      direction: "bearish",
      confidence: 0.6,
      token_symbol: "BTC",
      token_address: "addr",
      evidence: [],
      reasoning: "",
      uncertainty: "",
      confidence_rationale: "",
    })}\n\`\`\`\nEnd`;
    const result = parseAgentResponse(raw);
    expect(result.natural_text).toBe("From code block");
    expect(result.direction).toBe("bearish");
  });

  it("extracts JSON from ``` code block without json label", () => {
    const raw = `\`\`\`\n${JSON.stringify({
      natural_text: "No label block",
      direction: "neutral",
      confidence: 0.5,
    })}\n\`\`\``;
    const result = parseAgentResponse(raw);
    expect(result.natural_text).toBe("No label block");
  });

  it("repairs truncated JSON with missing closing brace", () => {
    const raw = '{"natural_text": "Truncated response", "direction": "bullish", "confidence": 0.7';
    const result = parseAgentResponse(raw);
    expect(result.natural_text).toBe("Truncated response");
    expect(result.direction).toBe("bullish");
    expect(result.confidence).toBe(0.7);
  });

  it("repairs truncated JSON with unclosed string and brace", () => {
    const raw = '{"natural_text": "Truncated here';
    const result = parseAgentResponse(raw);
    expect(result.natural_text).toBe("Truncated here");
  });

  it("repairs truncated JSON with unclosed array", () => {
    const raw = '{"natural_text": "Has array", "evidence": ["a", "b"';
    const result = parseAgentResponse(raw);
    expect(result.natural_text).toBe("Has array");
    expect(result.evidence).toEqual(["a", "b"]);
  });

  it("throws on completely invalid input (not JSON)", () => {
    expect(() => parseAgentResponse("This is not JSON at all")).toThrow(
      "Failed to parse LLM response as JSON"
    );
  });

  it("throws when parsed value is not an object", () => {
    expect(() => parseAgentResponse('"just a string"')).toThrow(
      "LLM response is not a JSON object"
    );
  });
});

// ============================================================
// parseAgentResponse
// ============================================================

describe("parseAgentResponse", () => {
  const validPayload = {
    should_post: true,
    natural_text: "SOL is showing strong momentum with increasing TVL.",
    token_symbol: "SOL",
    token_address: "So11111111111111111111111111111111111111112",
    direction: "bullish",
    confidence: 0.85,
    evidence: ["TVL increased 20%", "Volume spike detected"],
    reasoning: "Multiple bullish indicators converging",
    uncertainty: "Regulatory risks remain",
    confidence_rationale: "Strong on-chain data supports the call",
    price_target: 180.5,
  };

  it("parses a fully valid response", () => {
    const result = parseAgentResponse(JSON.stringify(validPayload));
    expect(result).toEqual({
      should_post: true,
      skip_reason: null,
      token_symbol: "SOL",
      token_address: "So11111111111111111111111111111111111111112",
      direction: "bullish",
      confidence: 0.85,
      evidence: ["TVL increased 20%", "Volume spike detected"],
      natural_text: "SOL is showing strong momentum with increasing TVL.",
      reasoning: "Multiple bullish indicators converging",
      uncertainty: "Regulatory risks remain",
      confidence_rationale: "Strong on-chain data supports the call",
      price_target: 180.5,
      price_target_rationale: null,
      stop_loss: null,
      stop_loss_rationale: null,
      allocation_pct: 0.10,
    });
  });

  it("returns skip output when should_post is false", () => {
    const raw = JSON.stringify({
      should_post: false,
      skip_reason: "Not enough data",
    });
    const result = parseAgentResponse(raw);
    expect(result.should_post).toBe(false);
    expect(result.skip_reason).toBe("Not enough data");
    expect(result.natural_text).toBe("");
    expect(result.direction).toBe("neutral");
    expect(result.confidence).toBe(0);
    expect(result.evidence).toEqual([]);
    expect(result.token_symbol).toBe("");
    expect(result.token_address).toBe("");
    expect(result.price_target).toBeNull();
    expect(result.allocation_pct).toBe(0);
  });

  it("uses default skip_reason when should_post is false and no reason given", () => {
    const raw = JSON.stringify({ should_post: false });
    const result = parseAgentResponse(raw);
    expect(result.should_post).toBe(false);
    expect(result.skip_reason).toBe("Agent decided not to post");
  });

  it("throws when natural_text is missing (should_post true)", () => {
    const payload = { ...validPayload, natural_text: undefined };
    expect(() => parseAgentResponse(JSON.stringify(payload))).toThrow(
      "LLM response missing natural_text"
    );
  });

  it("throws when natural_text is empty string", () => {
    const payload = { ...validPayload, natural_text: "" };
    expect(() => parseAgentResponse(JSON.stringify(payload))).toThrow(
      "LLM response missing natural_text"
    );
  });

  it("falls back direction to neutral for invalid direction", () => {
    const payload = { ...validPayload, direction: "sideways" };
    const result = parseAgentResponse(JSON.stringify(payload));
    expect(result.direction).toBe("neutral");
  });

  it("falls back direction to neutral when direction is not a string", () => {
    const payload = { ...validPayload, direction: 123 };
    const result = parseAgentResponse(JSON.stringify(payload));
    expect(result.direction).toBe("neutral");
  });

  it("clamps confidence above 1 to 1", () => {
    const payload = { ...validPayload, confidence: 1.5 };
    const result = parseAgentResponse(JSON.stringify(payload));
    expect(result.confidence).toBe(1);
  });

  it("clamps confidence below 0 to 0", () => {
    const payload = { ...validPayload, confidence: -0.3 };
    const result = parseAgentResponse(JSON.stringify(payload));
    expect(result.confidence).toBe(0);
  });

  it("defaults confidence to 0.5 when not a number", () => {
    const payload = { ...validPayload, confidence: "high" };
    const result = parseAgentResponse(JSON.stringify(payload));
    expect(result.confidence).toBe(0.5);
  });

  it("filters non-string evidence entries", () => {
    const payload = {
      ...validPayload,
      evidence: ["valid", 42, null, "also valid", true, { key: "val" }],
    };
    const result = parseAgentResponse(JSON.stringify(payload));
    expect(result.evidence).toEqual(["valid", "also valid"]);
  });

  it("defaults evidence to empty array when not an array", () => {
    const payload = { ...validPayload, evidence: "not an array" };
    const result = parseAgentResponse(JSON.stringify(payload));
    expect(result.evidence).toEqual([]);
  });

  it("parses valid price_target", () => {
    const payload = { ...validPayload, price_target: 250.75 };
    const result = parseAgentResponse(JSON.stringify(payload));
    expect(result.price_target).toBe(250.75);
  });

  it("returns null price_target when zero", () => {
    const payload = { ...validPayload, price_target: 0 };
    const result = parseAgentResponse(JSON.stringify(payload));
    expect(result.price_target).toBeNull();
  });

  it("returns null price_target when negative", () => {
    const payload = { ...validPayload, price_target: -10 };
    const result = parseAgentResponse(JSON.stringify(payload));
    expect(result.price_target).toBeNull();
  });

  it("returns null price_target when not a number", () => {
    const payload = { ...validPayload, price_target: "200" };
    const result = parseAgentResponse(JSON.stringify(payload));
    expect(result.price_target).toBeNull();
  });

  it("returns null price_target when missing", () => {
    const withoutPt = { ...validPayload };
    delete (withoutPt as Record<string, unknown>).price_target;
    const result = parseAgentResponse(JSON.stringify(withoutPt));
    expect(result.price_target).toBeNull();
  });

  it("defaults should_post to true when field is absent (backward compat)", () => {
    const withoutSp = { ...validPayload };
    delete (withoutSp as Record<string, unknown>).should_post;
    const result = parseAgentResponse(JSON.stringify(withoutSp));
    expect(result.should_post).toBe(true);
    expect(result.natural_text).toBe(validPayload.natural_text);
  });

  it("parses valid allocation_pct", () => {
    const payload = { ...validPayload, allocation_pct: 0.25 };
    const result = parseAgentResponse(JSON.stringify(payload));
    expect(result.allocation_pct).toBe(0.25);
  });

  it("defaults allocation_pct to 0.10 when missing", () => {
    const result = parseAgentResponse(JSON.stringify(validPayload));
    expect(result.allocation_pct).toBe(0.10);
  });

  it("defaults allocation_pct to 0.10 when not a number", () => {
    const payload = { ...validPayload, allocation_pct: "high" };
    const result = parseAgentResponse(JSON.stringify(payload));
    expect(result.allocation_pct).toBe(0.10);
  });

  it("clamps allocation_pct above 0.50 to 0.50", () => {
    const payload = { ...validPayload, allocation_pct: 0.80 };
    const result = parseAgentResponse(JSON.stringify(payload));
    expect(result.allocation_pct).toBe(0.50);
  });

  it("clamps allocation_pct below 0.01 to 0.01", () => {
    const payload = { ...validPayload, allocation_pct: 0.001 };
    const result = parseAgentResponse(JSON.stringify(payload));
    expect(result.allocation_pct).toBe(0.01);
  });

  it("defaults string fields to empty string when not strings", () => {
    const payload = {
      ...validPayload,
      token_symbol: 123,
      token_address: null,
      reasoning: false,
      uncertainty: [],
      confidence_rationale: {},
    };
    const result = parseAgentResponse(JSON.stringify(payload));
    expect(result.token_symbol).toBe("");
    expect(result.token_address).toBe("");
    expect(result.reasoning).toBe("");
    expect(result.uncertainty).toBe("");
    expect(result.confidence_rationale).toBe("");
  });
});

// ============================================================
// parseReplyResponse
// ============================================================

describe("parseReplyResponse", () => {
  const validReply = {
    natural_text: "I agree, SOL has strong fundamentals.",
    direction: "bullish",
    confidence: 0.75,
    agree: true,
    bookmark: true,
    bookmark_note: "Worth revisiting in a week",
    vote: "up",
    follow_author: true,
  };

  it("parses a fully valid reply response", () => {
    const result = parseReplyResponse(JSON.stringify(validReply));
    expect(result).toEqual({
      natural_text: "I agree, SOL has strong fundamentals.",
      direction: "bullish",
      confidence: 0.75,
      agree: true,
      bookmark: true,
      bookmark_note: "Worth revisiting in a week",
      vote: "up",
      follow_author: true,
    });
  });

  it("throws when natural_text is missing", () => {
    const payload = { ...validReply, natural_text: undefined };
    expect(() => parseReplyResponse(JSON.stringify(payload))).toThrow(
      "LLM reply response missing natural_text"
    );
  });

  it("throws when natural_text is empty", () => {
    const payload = { ...validReply, natural_text: "" };
    expect(() => parseReplyResponse(JSON.stringify(payload))).toThrow(
      "LLM reply response missing natural_text"
    );
  });

  it("defaults all optional fields when missing", () => {
    const payload = { natural_text: "Just a reply" };
    const result = parseReplyResponse(JSON.stringify(payload));
    expect(result.direction).toBe("neutral");
    expect(result.confidence).toBe(0.5);
    expect(result.agree).toBe(true);
    expect(result.bookmark).toBe(false);
    expect(result.bookmark_note).toBeNull();
    expect(result.vote).toBe("none");
    expect(result.follow_author).toBe(false);
  });

  it("defaults direction to neutral for invalid value", () => {
    const payload = { ...validReply, direction: "up" };
    const result = parseReplyResponse(JSON.stringify(payload));
    expect(result.direction).toBe("neutral");
  });

  it("clamps confidence to valid range", () => {
    const tooHigh = { ...validReply, confidence: 2.0 };
    expect(parseReplyResponse(JSON.stringify(tooHigh)).confidence).toBe(1);

    const tooLow = { ...validReply, confidence: -1.0 };
    expect(parseReplyResponse(JSON.stringify(tooLow)).confidence).toBe(0);
  });

  it("defaults confidence to 0.5 when not a number", () => {
    const payload = { ...validReply, confidence: "medium" };
    const result = parseReplyResponse(JSON.stringify(payload));
    expect(result.confidence).toBe(0.5);
  });

  it("defaults agree to true when not boolean", () => {
    const payload = { ...validReply, agree: "yes" };
    const result = parseReplyResponse(JSON.stringify(payload));
    expect(result.agree).toBe(true);
  });

  it("defaults bookmark to false when not boolean", () => {
    const payload = { ...validReply, bookmark: 1 };
    const result = parseReplyResponse(JSON.stringify(payload));
    expect(result.bookmark).toBe(false);
  });

  it("defaults bookmark_note to null when not a string", () => {
    const payload = { ...validReply, bookmark_note: 42 };
    const result = parseReplyResponse(JSON.stringify(payload));
    expect(result.bookmark_note).toBeNull();
  });

  it("defaults vote to none for invalid vote value", () => {
    const payload = { ...validReply, vote: "upvote" };
    const result = parseReplyResponse(JSON.stringify(payload));
    expect(result.vote).toBe("none");
  });

  it("accepts vote down", () => {
    const payload = { ...validReply, vote: "down" };
    const result = parseReplyResponse(JSON.stringify(payload));
    expect(result.vote).toBe("down");
  });

  it("defaults follow_author to false when not boolean", () => {
    const payload = { ...validReply, follow_author: "true" };
    const result = parseReplyResponse(JSON.stringify(payload));
    expect(result.follow_author).toBe(false);
  });
});

// ============================================================
// parseBrowseResponse
// ============================================================

describe("parseBrowseResponse", () => {
  const validPostIds = new Set(["post-1", "post-2", "post-3"]);
  const validMarketIds = new Set(["market-1", "market-2"]);

  it("parses valid response with reactions and market bets", () => {
    const raw = JSON.stringify({
      reactions: [
        {
          post_id: "post-1",
          like: true,
          vote: "up",
          bookmark: false,
          follow_author: true,
          reason: "Great analysis",
        },
        {
          post_id: "post-2",
          like: false,
          vote: "down",
          bookmark: true,
          follow_author: false,
          reason: "Disagree with thesis",
        },
      ],
      market_bets: [
        {
          market_id: "market-1",
          side: "yes",
          reason: "Strong conviction",
        },
      ],
      market_mood: "Cautiously optimistic",
    });

    const result = parseBrowseResponse(raw, validPostIds, validMarketIds);

    expect(result.reactions).toHaveLength(2);
    expect(result.reactions[0]).toEqual({
      post_id: "post-1",
      like: true,
      vote: "up",
      bookmark: false,
      follow_author: true,
      reason: "Great analysis",
    });
    expect(result.reactions[1]).toEqual({
      post_id: "post-2",
      like: false,
      vote: "down",
      bookmark: true,
      follow_author: false,
      reason: "Disagree with thesis",
    });
    expect(result.market_bets).toHaveLength(1);
    expect(result.market_bets[0]).toEqual({
      market_id: "market-1",
      side: "yes",
      reason: "Strong conviction",
    });
    expect(result.market_mood).toBe("Cautiously optimistic");
  });

  it("filters out reactions with invalid post_ids", () => {
    const raw = JSON.stringify({
      reactions: [
        { post_id: "post-1", like: true, vote: "up", reason: "Valid" },
        { post_id: "unknown-id", like: true, vote: "up", reason: "Invalid" },
        { post_id: "post-2", like: false, vote: "none", reason: "Valid 2" },
      ],
      market_bets: [],
      market_mood: "",
    });

    const result = parseBrowseResponse(raw, validPostIds);
    expect(result.reactions).toHaveLength(2);
    expect(result.reactions[0].post_id).toBe("post-1");
    expect(result.reactions[1].post_id).toBe("post-2");
  });

  it("filters out reactions with empty post_id", () => {
    const raw = JSON.stringify({
      reactions: [
        { post_id: "", like: true, vote: "up", reason: "Empty ID" },
        { post_id: "post-1", like: true, vote: "up", reason: "Valid" },
      ],
      market_bets: [],
      market_mood: "",
    });

    const result = parseBrowseResponse(raw, validPostIds);
    expect(result.reactions).toHaveLength(1);
    expect(result.reactions[0].post_id).toBe("post-1");
  });

  it("enforces max 10 reactions limit", () => {
    const reactions = Array.from({ length: 15 }, (_, i) => ({
      post_id: `post-${i}`,
      like: true,
      vote: "up",
      reason: `Reaction ${i}`,
    }));
    const allPostIds = new Set(reactions.map((r) => r.post_id));

    const raw = JSON.stringify({ reactions, market_bets: [], market_mood: "" });
    const result = parseBrowseResponse(raw, allPostIds);
    expect(result.reactions).toHaveLength(10);
  });

  it("enforces max 3 market bets limit", () => {
    const bets = Array.from({ length: 5 }, (_, i) => ({
      market_id: `market-${i}`,
      side: "yes",
      reason: `Bet ${i}`,
    }));
    const allMarketIds = new Set(bets.map((b) => b.market_id));

    const raw = JSON.stringify({
      reactions: [],
      market_bets: bets,
      market_mood: "",
    });
    const result = parseBrowseResponse(raw, validPostIds, allMarketIds);
    expect(result.market_bets).toHaveLength(3);
  });

  it("defaults vote to none for invalid vote values in reactions", () => {
    const raw = JSON.stringify({
      reactions: [
        { post_id: "post-1", like: true, vote: "upvote", reason: "Invalid vote" },
      ],
      market_bets: [],
      market_mood: "",
    });

    const result = parseBrowseResponse(raw, validPostIds);
    expect(result.reactions[0].vote).toBe("none");
  });

  it("skips market bets with invalid side", () => {
    const raw = JSON.stringify({
      reactions: [],
      market_bets: [
        { market_id: "market-1", side: "maybe", reason: "Invalid side" },
        { market_id: "market-2", side: "no", reason: "Valid bet" },
      ],
      market_mood: "",
    });

    const result = parseBrowseResponse(raw, validPostIds, validMarketIds);
    expect(result.market_bets).toHaveLength(1);
    expect(result.market_bets[0].side).toBe("no");
  });

  it("skips market bets with invalid market_id", () => {
    const raw = JSON.stringify({
      reactions: [],
      market_bets: [
        { market_id: "unknown-market", side: "yes", reason: "Unknown" },
      ],
      market_mood: "",
    });

    const result = parseBrowseResponse(raw, validPostIds, validMarketIds);
    expect(result.market_bets).toHaveLength(0);
  });

  it("skips non-object entries in reactions array", () => {
    const raw = JSON.stringify({
      reactions: [
        "not an object",
        null,
        42,
        { post_id: "post-1", like: true, vote: "up", reason: "Valid" },
      ],
      market_bets: [],
      market_mood: "",
    });

    const result = parseBrowseResponse(raw, validPostIds);
    expect(result.reactions).toHaveLength(1);
  });

  it("skips non-object entries in market_bets array", () => {
    const raw = JSON.stringify({
      reactions: [],
      market_bets: [null, "bad", { market_id: "market-1", side: "yes", reason: "OK" }],
      market_mood: "",
    });

    const result = parseBrowseResponse(raw, validPostIds, validMarketIds);
    expect(result.market_bets).toHaveLength(1);
  });

  it("defaults boolean fields to false in reactions", () => {
    const raw = JSON.stringify({
      reactions: [
        { post_id: "post-1", vote: "up", reason: "No booleans" },
      ],
      market_bets: [],
      market_mood: "",
    });

    const result = parseBrowseResponse(raw, validPostIds);
    expect(result.reactions[0].like).toBe(false);
    expect(result.reactions[0].bookmark).toBe(false);
    expect(result.reactions[0].follow_author).toBe(false);
  });

  it("defaults reason to empty string when not a string", () => {
    const raw = JSON.stringify({
      reactions: [
        { post_id: "post-1", like: true, vote: "up", reason: 42 },
      ],
      market_bets: [],
      market_mood: "",
    });

    const result = parseBrowseResponse(raw, validPostIds);
    expect(result.reactions[0].reason).toBe("");
  });

  it("defaults market_mood to empty string when not a string", () => {
    const raw = JSON.stringify({
      reactions: [],
      market_bets: [],
      market_mood: 123,
    });

    const result = parseBrowseResponse(raw, validPostIds);
    expect(result.market_mood).toBe("");
  });

  it("defaults reactions and market_bets to empty arrays when not arrays", () => {
    const raw = JSON.stringify({
      reactions: "not an array",
      market_bets: null,
      market_mood: "ok",
    });

    const result = parseBrowseResponse(raw, validPostIds);
    expect(result.reactions).toEqual([]);
    expect(result.market_bets).toEqual([]);
  });

  it("uses empty set as default for validMarketIds", () => {
    const raw = JSON.stringify({
      reactions: [],
      market_bets: [
        { market_id: "market-1", side: "yes", reason: "No valid markets" },
      ],
      market_mood: "",
    });

    // Not passing validMarketIds — should default to empty set
    const result = parseBrowseResponse(raw, validPostIds);
    expect(result.market_bets).toHaveLength(0);
  });
});

// ============================================================
// parseNewsResponse
// ============================================================

describe("parseNewsResponse", () => {
  const validNews = {
    natural_text: "Solana DeFi TVL surpasses $10B as lending protocols surge.",
    token_symbol: "SOL",
    token_address: "So11111111111111111111111111111111111111112",
    category: "defi",
    headline: "Solana DeFi TVL Hits $10B",
  };

  it("parses a fully valid news response", () => {
    const result = parseNewsResponse(JSON.stringify(validNews));
    expect(result).toEqual({
      natural_text: "Solana DeFi TVL surpasses $10B as lending protocols surge.",
      token_symbol: "SOL",
      token_address: "So11111111111111111111111111111111111111112",
      category: "defi",
      headline: "Solana DeFi TVL Hits $10B",
    });
  });

  it("throws when natural_text is missing", () => {
    const payload = { ...validNews, natural_text: undefined };
    expect(() => parseNewsResponse(JSON.stringify(payload))).toThrow(
      "LLM news response missing natural_text"
    );
  });

  it("throws when natural_text is empty", () => {
    const payload = { ...validNews, natural_text: "" };
    expect(() => parseNewsResponse(JSON.stringify(payload))).toThrow(
      "LLM news response missing natural_text"
    );
  });

  it("throws when headline is missing", () => {
    const payload = { ...validNews, headline: undefined };
    expect(() => parseNewsResponse(JSON.stringify(payload))).toThrow(
      "LLM news response missing headline"
    );
  });

  it("throws when headline is empty", () => {
    const payload = { ...validNews, headline: "" };
    expect(() => parseNewsResponse(JSON.stringify(payload))).toThrow(
      "LLM news response missing headline"
    );
  });

  it("falls back category to market for invalid category", () => {
    const payload = { ...validNews, category: "sports" };
    const result = parseNewsResponse(JSON.stringify(payload));
    expect(result.category).toBe("market");
  });

  it("falls back category to market when not a string", () => {
    const payload = { ...validNews, category: 42 };
    const result = parseNewsResponse(JSON.stringify(payload));
    expect(result.category).toBe("market");
  });

  it("accepts all valid categories", () => {
    const categories = ["onchain", "regulatory", "defi", "market", "social"] as const;
    for (const cat of categories) {
      const payload = { ...validNews, category: cat };
      const result = parseNewsResponse(JSON.stringify(payload));
      expect(result.category).toBe(cat);
    }
  });

  it("defaults token_symbol to empty string when not a string", () => {
    const payload = { ...validNews, token_symbol: 123 };
    const result = parseNewsResponse(JSON.stringify(payload));
    expect(result.token_symbol).toBe("");
  });

  it("defaults token_address to empty string when not a string", () => {
    const payload = { ...validNews, token_address: null };
    const result = parseNewsResponse(JSON.stringify(payload));
    expect(result.token_address).toBe("");
  });
});

// ============================================================
// parsePricingResponse
// ============================================================

describe("parsePricingResponse", () => {
  it("parses a valid pricing response", () => {
    const raw = JSON.stringify({ price_usdc: 15.99, reasoning: "Based on market demand" });
    const result = parsePricingResponse(raw);
    expect(result.price_usdc).toBe(15.99);
    expect(result.reasoning).toBe("Based on market demand");
  });

  it("clamps price below $1 to $1", () => {
    const raw = JSON.stringify({ price_usdc: 0.5, reasoning: "Too low" });
    const result = parsePricingResponse(raw);
    expect(result.price_usdc).toBe(1);
  });

  it("clamps price above $30 to $30", () => {
    const raw = JSON.stringify({ price_usdc: 99.99, reasoning: "Too high" });
    const result = parsePricingResponse(raw);
    expect(result.price_usdc).toBe(30);
  });

  it("clamps negative price to $1", () => {
    const raw = JSON.stringify({ price_usdc: -5, reasoning: "Negative" });
    const result = parsePricingResponse(raw);
    expect(result.price_usdc).toBe(1);
  });

  it("rounds price to 2 decimal places", () => {
    const raw = JSON.stringify({ price_usdc: 12.456, reasoning: "Precise" });
    const result = parsePricingResponse(raw);
    expect(result.price_usdc).toBe(12.46);
  });

  it("rounds price at the boundary correctly", () => {
    const raw = JSON.stringify({ price_usdc: 5.555, reasoning: "Boundary" });
    const result = parsePricingResponse(raw);
    expect(result.price_usdc).toBe(5.56);
  });

  it("defaults price_usdc to 9.99 when not a number", () => {
    const raw = JSON.stringify({ price_usdc: "ten dollars", reasoning: "String price" });
    const result = parsePricingResponse(raw);
    expect(result.price_usdc).toBe(9.99);
  });

  it("defaults price_usdc to 9.99 when missing", () => {
    const raw = JSON.stringify({ reasoning: "No price given" });
    const result = parsePricingResponse(raw);
    expect(result.price_usdc).toBe(9.99);
  });

  it("defaults reasoning to empty string when not a string", () => {
    const raw = JSON.stringify({ price_usdc: 10, reasoning: 42 });
    const result = parsePricingResponse(raw);
    expect(result.reasoning).toBe("");
  });

  it("defaults reasoning to empty string when missing", () => {
    const raw = JSON.stringify({ price_usdc: 10 });
    const result = parsePricingResponse(raw);
    expect(result.reasoning).toBe("");
  });

  it("applies clamping before rounding", () => {
    // 0.004 should clamp to 1 (not round to 0.00 then clamp)
    const raw = JSON.stringify({ price_usdc: 0.004, reasoning: "Tiny" });
    const result = parsePricingResponse(raw);
    expect(result.price_usdc).toBe(1);
  });

  it("handles exact boundary values", () => {
    const rawMin = JSON.stringify({ price_usdc: 1, reasoning: "" });
    expect(parsePricingResponse(rawMin).price_usdc).toBe(1);

    const rawMax = JSON.stringify({ price_usdc: 30, reasoning: "" });
    expect(parsePricingResponse(rawMax).price_usdc).toBe(30);
  });
});
