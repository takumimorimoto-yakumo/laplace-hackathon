import { describe, it, expect } from "vitest";
import {
  agentRegistrationSchema,
  createPostSchema,
  paginationSchema,
  postsQuerySchema,
  predictionsQuerySchema,
  formatZodErrors,
} from "@/lib/api/validate";
import { z } from "zod";

// ---------------------------------------------------------------------------
// agentRegistrationSchema
// ---------------------------------------------------------------------------

describe("agentRegistrationSchema", () => {
  const validBase = { name: "Alpha Agent", style: "swing" as const };

  describe("name", () => {
    it("accepts a valid name", () => {
      const result = agentRegistrationSchema.safeParse(validBase);
      expect(result.success).toBe(true);
    });

    it("accepts names with hyphens, underscores, and numbers", () => {
      const result = agentRegistrationSchema.safeParse({
        ...validBase,
        name: "Agent_01-X",
      });
      expect(result.success).toBe(true);
    });

    it("accepts a 2-character name (minimum)", () => {
      const result = agentRegistrationSchema.safeParse({
        ...validBase,
        name: "AB",
      });
      expect(result.success).toBe(true);
    });

    it("accepts a 30-character name (maximum)", () => {
      const result = agentRegistrationSchema.safeParse({
        ...validBase,
        name: "A".repeat(30),
      });
      expect(result.success).toBe(true);
    });

    it("rejects a 1-character name", () => {
      const result = agentRegistrationSchema.safeParse({
        ...validBase,
        name: "A",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Name must be at least 2 characters"
        );
      }
    });

    it("rejects a 31-character name", () => {
      const result = agentRegistrationSchema.safeParse({
        ...validBase,
        name: "A".repeat(31),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Name must be at most 30 characters"
        );
      }
    });

    it("rejects an empty string", () => {
      const result = agentRegistrationSchema.safeParse({
        ...validBase,
        name: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects names with special characters", () => {
      const names = ["Agent@1", "Hello!", "Agent#2", "Foo&Bar", "Test.dot"];
      for (const name of names) {
        const result = agentRegistrationSchema.safeParse({
          ...validBase,
          name,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe(
            "Name can only contain letters, numbers, spaces, hyphens, and underscores"
          );
        }
      }
    });

    it("rejects missing name", () => {
      const result = agentRegistrationSchema.safeParse({ style: "swing" });
      expect(result.success).toBe(false);
    });
  });

  describe("style", () => {
    const validStyles = [
      "swing",
      "daytrader",
      "macro",
      "contrarian",
      "quant",
      "degen",
    ] as const;

    it.each(validStyles)("accepts style '%s'", (style) => {
      const result = agentRegistrationSchema.safeParse({
        ...validBase,
        style,
      });
      expect(result.success).toBe(true);
    });

    it("rejects an invalid style", () => {
      const result = agentRegistrationSchema.safeParse({
        ...validBase,
        style: "scalper",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing style", () => {
      const result = agentRegistrationSchema.safeParse({ name: "Test Agent" });
      expect(result.success).toBe(false);
    });
  });

  describe("bio", () => {
    it("defaults to empty string when omitted", () => {
      const result = agentRegistrationSchema.parse(validBase);
      expect(result.bio).toBe("");
    });

    it("accepts a valid bio", () => {
      const result = agentRegistrationSchema.safeParse({
        ...validBase,
        bio: "I trade SOL on-chain",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bio).toBe("I trade SOL on-chain");
      }
    });

    it("accepts a 200-character bio (maximum)", () => {
      const result = agentRegistrationSchema.safeParse({
        ...validBase,
        bio: "X".repeat(200),
      });
      expect(result.success).toBe(true);
    });

    it("rejects a 201-character bio", () => {
      const result = agentRegistrationSchema.safeParse({
        ...validBase,
        bio: "X".repeat(201),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Bio must be at most 200 characters"
        );
      }
    });
  });

  describe("outlook", () => {
    it("defaults to 'bullish' when omitted", () => {
      const result = agentRegistrationSchema.parse(validBase);
      expect(result.outlook).toBe("bullish");
    });

    const validOutlooks = [
      "ultra_bullish",
      "bullish",
      "bearish",
      "ultra_bearish",
    ] as const;

    it.each(validOutlooks)("accepts outlook '%s'", (outlook) => {
      const result = agentRegistrationSchema.safeParse({
        ...validBase,
        outlook,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.outlook).toBe(outlook);
      }
    });

    it("rejects an invalid outlook", () => {
      const result = agentRegistrationSchema.safeParse({
        ...validBase,
        outlook: "neutral",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("wallet_address", () => {
    // A plausible Solana base58 address (44 chars, no 0/O/I/l)
    const validWallet = "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV1";

    it("is optional and absent by default", () => {
      const result = agentRegistrationSchema.parse(validBase);
      expect(result.wallet_address).toBeUndefined();
    });

    it("accepts a valid 44-character base58 address", () => {
      const result = agentRegistrationSchema.safeParse({
        ...validBase,
        wallet_address: validWallet,
      });
      expect(result.success).toBe(true);
    });

    it("accepts a 32-character base58 address (minimum)", () => {
      const addr = "2".repeat(32);
      const result = agentRegistrationSchema.safeParse({
        ...validBase,
        wallet_address: addr,
      });
      expect(result.success).toBe(true);
    });

    it("rejects a 31-character address (too short)", () => {
      const result = agentRegistrationSchema.safeParse({
        ...validBase,
        wallet_address: "2".repeat(31),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Invalid Solana wallet address"
        );
      }
    });

    it("rejects a 45-character address (too long)", () => {
      const result = agentRegistrationSchema.safeParse({
        ...validBase,
        wallet_address: "2".repeat(45),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Invalid Solana wallet address"
        );
      }
    });

    it("rejects addresses with invalid base58 characters (0, O, I, l)", () => {
      const badChars = ["0", "O", "I", "l"];
      for (const ch of badChars) {
        const addr = ch + "2".repeat(31);
        const result = agentRegistrationSchema.safeParse({
          ...validBase,
          wallet_address: addr,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe(
            "Invalid base58 address"
          );
        }
      }
    });
  });
});

// ---------------------------------------------------------------------------
// createPostSchema
// ---------------------------------------------------------------------------

describe("createPostSchema", () => {
  const validBase = { natural_text: "SOL is looking strong today" };

  describe("natural_text", () => {
    it("accepts valid text", () => {
      const result = createPostSchema.safeParse(validBase);
      expect(result.success).toBe(true);
    });

    it("rejects empty string", () => {
      const result = createPostSchema.safeParse({ natural_text: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Post text is required");
      }
    });

    it("rejects text exceeding 500 characters", () => {
      const result = createPostSchema.safeParse({
        natural_text: "A".repeat(501),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Post text must be at most 500 characters"
        );
      }
    });

    it("accepts exactly 500 characters", () => {
      const result = createPostSchema.safeParse({
        natural_text: "A".repeat(500),
      });
      expect(result.success).toBe(true);
    });

    it("accepts exactly 1 character", () => {
      const result = createPostSchema.safeParse({ natural_text: "X" });
      expect(result.success).toBe(true);
    });

    it("rejects missing natural_text", () => {
      const result = createPostSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("direction", () => {
    it("defaults to 'neutral' when omitted", () => {
      const result = createPostSchema.parse(validBase);
      expect(result.direction).toBe("neutral");
    });

    it.each(["bullish", "bearish", "neutral"] as const)(
      "accepts direction '%s'",
      (direction) => {
        const result = createPostSchema.safeParse({
          ...validBase,
          direction,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.direction).toBe(direction);
        }
      }
    );

    it("rejects invalid direction", () => {
      const result = createPostSchema.safeParse({
        ...validBase,
        direction: "sideways",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("confidence", () => {
    it("defaults to 0.5 when omitted", () => {
      const result = createPostSchema.parse(validBase);
      expect(result.confidence).toBe(0.5);
    });

    it("accepts 0 (minimum)", () => {
      const result = createPostSchema.safeParse({
        ...validBase,
        confidence: 0,
      });
      expect(result.success).toBe(true);
    });

    it("accepts 1 (maximum)", () => {
      const result = createPostSchema.safeParse({
        ...validBase,
        confidence: 1,
      });
      expect(result.success).toBe(true);
    });

    it("accepts 0.75", () => {
      const result = createPostSchema.safeParse({
        ...validBase,
        confidence: 0.75,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.confidence).toBe(0.75);
      }
    });

    it("rejects negative confidence", () => {
      const result = createPostSchema.safeParse({
        ...validBase,
        confidence: -0.1,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Confidence must be between 0 and 1"
        );
      }
    });

    it("rejects confidence greater than 1", () => {
      const result = createPostSchema.safeParse({
        ...validBase,
        confidence: 1.01,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Confidence must be between 0 and 1"
        );
      }
    });
  });

  describe("token_symbol", () => {
    it("is optional", () => {
      const result = createPostSchema.parse(validBase);
      expect(result.token_symbol).toBeUndefined();
    });

    it("accepts a valid token symbol", () => {
      const result = createPostSchema.safeParse({
        ...validBase,
        token_symbol: "SOL",
      });
      expect(result.success).toBe(true);
    });

    it("rejects a token symbol exceeding 20 characters", () => {
      const result = createPostSchema.safeParse({
        ...validBase,
        token_symbol: "A".repeat(21),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("token_address", () => {
    it("is optional", () => {
      const result = createPostSchema.parse(validBase);
      expect(result.token_address).toBeUndefined();
    });

    it("accepts a valid token address", () => {
      const result = createPostSchema.safeParse({
        ...validBase,
        token_address: "So11111111111111111111111111111111111111112",
      });
      expect(result.success).toBe(true);
    });

    it("rejects a token address exceeding 100 characters", () => {
      const result = createPostSchema.safeParse({
        ...validBase,
        token_address: "X".repeat(101),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("evidence", () => {
    it("defaults to empty array when omitted", () => {
      const result = createPostSchema.parse(validBase);
      expect(result.evidence).toEqual([]);
    });

    it("accepts up to 5 evidence items", () => {
      const result = createPostSchema.safeParse({
        ...validBase,
        evidence: ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5"],
      });
      expect(result.success).toBe(true);
    });

    it("rejects more than 5 evidence items", () => {
      const result = createPostSchema.safeParse({
        ...validBase,
        evidence: [
          "Point 1",
          "Point 2",
          "Point 3",
          "Point 4",
          "Point 5",
          "Point 6",
        ],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Maximum 5 evidence items"
        );
      }
    });

    it("rejects an evidence item exceeding 200 characters", () => {
      const result = createPostSchema.safeParse({
        ...validBase,
        evidence: ["X".repeat(201)],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Each evidence item must be at most 200 characters"
        );
      }
    });

    it("accepts evidence items with exactly 200 characters", () => {
      const result = createPostSchema.safeParse({
        ...validBase,
        evidence: ["Y".repeat(200)],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("price_target", () => {
    it("is optional", () => {
      const result = createPostSchema.parse(validBase);
      expect(result.price_target).toBeUndefined();
    });

    it("accepts a positive number", () => {
      const result = createPostSchema.safeParse({
        ...validBase,
        price_target: 150.5,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.price_target).toBe(150.5);
      }
    });

    it("rejects zero", () => {
      const result = createPostSchema.safeParse({
        ...validBase,
        price_target: 0,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Price target must be positive"
        );
      }
    });

    it("rejects negative numbers", () => {
      const result = createPostSchema.safeParse({
        ...validBase,
        price_target: -10,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Price target must be positive"
        );
      }
    });
  });
});

// ---------------------------------------------------------------------------
// paginationSchema
// ---------------------------------------------------------------------------

describe("paginationSchema", () => {
  describe("defaults", () => {
    it("applies default limit of 20 and offset of 0", () => {
      const result = paginationSchema.parse({});
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });
  });

  describe("string coercion", () => {
    it("coerces string limit to number", () => {
      const result = paginationSchema.parse({ limit: "10" });
      expect(result.limit).toBe(10);
    });

    it("coerces string offset to number", () => {
      const result = paginationSchema.parse({ offset: "5" });
      expect(result.offset).toBe(5);
    });

    it("coerces both limit and offset from strings", () => {
      const result = paginationSchema.parse({ limit: "50", offset: "25" });
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(25);
    });
  });

  describe("limit", () => {
    it("accepts limit of 1 (minimum)", () => {
      const result = paginationSchema.safeParse({ limit: 1 });
      expect(result.success).toBe(true);
    });

    it("accepts limit of 100 (maximum)", () => {
      const result = paginationSchema.safeParse({ limit: 100 });
      expect(result.success).toBe(true);
    });

    it("rejects limit of 0", () => {
      const result = paginationSchema.safeParse({ limit: 0 });
      expect(result.success).toBe(false);
    });

    it("rejects limit of 101", () => {
      const result = paginationSchema.safeParse({ limit: 101 });
      expect(result.success).toBe(false);
    });

    it("rejects non-integer limit", () => {
      const result = paginationSchema.safeParse({ limit: 10.5 });
      expect(result.success).toBe(false);
    });
  });

  describe("offset", () => {
    it("accepts offset of 0 (minimum)", () => {
      const result = paginationSchema.safeParse({ offset: 0 });
      expect(result.success).toBe(true);
    });

    it("rejects negative offset", () => {
      const result = paginationSchema.safeParse({ offset: -1 });
      expect(result.success).toBe(false);
    });

    it("rejects non-integer offset", () => {
      const result = paginationSchema.safeParse({ offset: 2.5 });
      expect(result.success).toBe(false);
    });

    it("accepts a large integer offset", () => {
      const result = paginationSchema.safeParse({ offset: 9999 });
      expect(result.success).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// postsQuerySchema
// ---------------------------------------------------------------------------

describe("postsQuerySchema", () => {
  describe("defaults", () => {
    it("applies default limit and offset when empty", () => {
      const result = postsQuerySchema.parse({});
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });
  });

  describe("agent_id", () => {
    it("is optional", () => {
      const result = postsQuerySchema.parse({});
      expect(result.agent_id).toBeUndefined();
    });

    it("accepts a valid UUID", () => {
      const result = postsQuerySchema.safeParse({
        agent_id: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.success).toBe(true);
    });

    it("rejects an invalid UUID", () => {
      const result = postsQuerySchema.safeParse({
        agent_id: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a UUID missing dashes", () => {
      const result = postsQuerySchema.safeParse({
        agent_id: "550e8400e29b41d4a716446655440000",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("token_symbol", () => {
    it("is optional", () => {
      const result = postsQuerySchema.parse({});
      expect(result.token_symbol).toBeUndefined();
    });

    it("accepts a valid symbol", () => {
      const result = postsQuerySchema.safeParse({ token_symbol: "BTC" });
      expect(result.success).toBe(true);
    });

    it("rejects a symbol exceeding 20 characters", () => {
      const result = postsQuerySchema.safeParse({
        token_symbol: "A".repeat(21),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("direction", () => {
    it("is optional", () => {
      const result = postsQuerySchema.parse({});
      expect(result.direction).toBeUndefined();
    });

    it.each(["bullish", "bearish", "neutral"] as const)(
      "accepts direction '%s'",
      (direction) => {
        const result = postsQuerySchema.safeParse({ direction });
        expect(result.success).toBe(true);
      }
    );

    it("rejects invalid direction", () => {
      const result = postsQuerySchema.safeParse({ direction: "up" });
      expect(result.success).toBe(false);
    });
  });

  describe("post_type", () => {
    it("is optional", () => {
      const result = postsQuerySchema.parse({});
      expect(result.post_type).toBeUndefined();
    });

    const validTypes = [
      "prediction",
      "reply",
      "alert",
      "original",
      "quote",
      "update",
      "synthesis",
      "contrarian",
    ] as const;

    it.each(validTypes)("accepts post_type '%s'", (post_type) => {
      const result = postsQuerySchema.safeParse({ post_type });
      expect(result.success).toBe(true);
    });

    it("rejects invalid post_type", () => {
      const result = postsQuerySchema.safeParse({ post_type: "thread" });
      expect(result.success).toBe(false);
    });
  });

  describe("combined query", () => {
    it("accepts all parameters together", () => {
      const result = postsQuerySchema.safeParse({
        limit: "50",
        offset: "10",
        agent_id: "550e8400-e29b-41d4-a716-446655440000",
        token_symbol: "SOL",
        direction: "bullish",
        post_type: "prediction",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(10);
        expect(result.data.agent_id).toBe(
          "550e8400-e29b-41d4-a716-446655440000"
        );
        expect(result.data.token_symbol).toBe("SOL");
        expect(result.data.direction).toBe("bullish");
        expect(result.data.post_type).toBe("prediction");
      }
    });
  });
});

// ---------------------------------------------------------------------------
// predictionsQuerySchema
// ---------------------------------------------------------------------------

describe("predictionsQuerySchema", () => {
  describe("defaults", () => {
    it("applies default limit and offset when empty", () => {
      const result = predictionsQuerySchema.parse({});
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });
  });

  describe("agent_id", () => {
    it("is optional", () => {
      const result = predictionsQuerySchema.parse({});
      expect(result.agent_id).toBeUndefined();
    });

    it("accepts a valid UUID", () => {
      const result = predictionsQuerySchema.safeParse({
        agent_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      });
      expect(result.success).toBe(true);
    });

    it("rejects an invalid UUID", () => {
      const result = predictionsQuerySchema.safeParse({
        agent_id: "invalid-uuid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("token_symbol", () => {
    it("is optional", () => {
      const result = predictionsQuerySchema.parse({});
      expect(result.token_symbol).toBeUndefined();
    });

    it("accepts a valid symbol", () => {
      const result = predictionsQuerySchema.safeParse({
        token_symbol: "ETH",
      });
      expect(result.success).toBe(true);
    });

    it("rejects a symbol exceeding 20 characters", () => {
      const result = predictionsQuerySchema.safeParse({
        token_symbol: "T".repeat(21),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("resolved", () => {
    it("is optional", () => {
      const result = predictionsQuerySchema.parse({});
      expect(result.resolved).toBeUndefined();
    });

    it("accepts 'true'", () => {
      const result = predictionsQuerySchema.safeParse({ resolved: "true" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.resolved).toBe("true");
      }
    });

    it("accepts 'false'", () => {
      const result = predictionsQuerySchema.safeParse({ resolved: "false" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.resolved).toBe("false");
      }
    });

    it("rejects boolean true (must be string)", () => {
      const result = predictionsQuerySchema.safeParse({ resolved: true });
      expect(result.success).toBe(false);
    });

    it("rejects arbitrary strings", () => {
      const result = predictionsQuerySchema.safeParse({ resolved: "yes" });
      expect(result.success).toBe(false);
    });
  });

  describe("pagination (limit/offset)", () => {
    it("coerces string limit", () => {
      const result = predictionsQuerySchema.parse({ limit: "30" });
      expect(result.limit).toBe(30);
    });

    it("rejects limit of 0", () => {
      const result = predictionsQuerySchema.safeParse({ limit: 0 });
      expect(result.success).toBe(false);
    });

    it("rejects limit exceeding 100", () => {
      const result = predictionsQuerySchema.safeParse({ limit: 200 });
      expect(result.success).toBe(false);
    });
  });

  describe("combined query", () => {
    it("accepts all parameters together", () => {
      const result = predictionsQuerySchema.safeParse({
        limit: "25",
        offset: "5",
        agent_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        token_symbol: "SOL",
        resolved: "true",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(25);
        expect(result.data.offset).toBe(5);
        expect(result.data.agent_id).toBe(
          "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        );
        expect(result.data.token_symbol).toBe("SOL");
        expect(result.data.resolved).toBe("true");
      }
    });
  });
});

// ---------------------------------------------------------------------------
// formatZodErrors
// ---------------------------------------------------------------------------

describe("formatZodErrors", () => {
  it("formats a single error without path", () => {
    const result = z.string().min(5).safeParse("Hi");
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = formatZodErrors(result.error);
      expect(messages).toHaveLength(1);
      // Top-level validation has no path, so no "field: " prefix
      expect(messages[0]).not.toMatch(/^[a-zA-Z_.]+: /);
      expect(messages[0]).toBeTruthy();
    }
  });

  it("formats a single error with path", () => {
    const schema = z.object({
      name: z.string().min(5, "Name too short"),
    });
    const result = schema.safeParse({ name: "Hi" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = formatZodErrors(result.error);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toBe("name: Name too short");
    }
  });

  it("formats multiple errors", () => {
    const result = agentRegistrationSchema.safeParse({
      name: "",
      style: "invalid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = formatZodErrors(result.error);
      expect(messages.length).toBeGreaterThanOrEqual(2);
      // Each message should be a non-empty string
      for (const msg of messages) {
        expect(typeof msg).toBe("string");
        expect(msg.length).toBeGreaterThan(0);
      }
    }
  });

  it("formats nested path errors with dot notation", () => {
    const schema = z.object({
      user: z.object({
        email: z.string().email("Invalid email"),
      }),
    });
    const result = schema.safeParse({ user: { email: "not-an-email" } });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = formatZodErrors(result.error);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toBe("user.email: Invalid email");
    }
  });

  it("returns empty array for no errors", () => {
    // Create a ZodError with no issues manually
    const zodError = new z.ZodError([]);
    const messages = formatZodErrors(zodError);
    expect(messages).toEqual([]);
  });
});
