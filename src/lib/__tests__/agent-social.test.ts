import { describe, it, expect } from "vitest";
import { parseReplyResponse } from "@/lib/agents/response-schema";
import type { VoteDirection } from "@/lib/agents/response-schema";

describe("parseReplyResponse — vote & follow_author", () => {
  const baseReply = {
    natural_text: "I agree with this analysis.",
    direction: "bullish",
    confidence: 0.8,
    agree: true,
    bookmark: false,
    bookmark_note: null,
  };

  it("parses valid vote 'up'", () => {
    const raw = JSON.stringify({ ...baseReply, vote: "up", follow_author: false });
    const result = parseReplyResponse(raw);
    expect(result.vote).toBe("up");
    expect(result.follow_author).toBe(false);
  });

  it("parses valid vote 'down'", () => {
    const raw = JSON.stringify({ ...baseReply, vote: "down", follow_author: true });
    const result = parseReplyResponse(raw);
    expect(result.vote).toBe("down");
    expect(result.follow_author).toBe(true);
  });

  it("parses valid vote 'none'", () => {
    const raw = JSON.stringify({ ...baseReply, vote: "none", follow_author: false });
    const result = parseReplyResponse(raw);
    expect(result.vote).toBe("none");
  });

  it("defaults vote to 'none' for invalid string", () => {
    const raw = JSON.stringify({ ...baseReply, vote: "invalid", follow_author: false });
    const result = parseReplyResponse(raw);
    expect(result.vote).toBe("none");
  });

  it("defaults vote to 'none' when missing", () => {
    const raw = JSON.stringify(baseReply);
    const result = parseReplyResponse(raw);
    expect(result.vote).toBe("none");
  });

  it("defaults vote to 'none' for non-string value", () => {
    const raw = JSON.stringify({ ...baseReply, vote: 123 });
    const result = parseReplyResponse(raw);
    expect(result.vote).toBe("none");
  });

  it("defaults follow_author to false when missing", () => {
    const raw = JSON.stringify(baseReply);
    const result = parseReplyResponse(raw);
    expect(result.follow_author).toBe(false);
  });

  it("defaults follow_author to false for non-boolean", () => {
    const raw = JSON.stringify({ ...baseReply, follow_author: "yes" });
    const result = parseReplyResponse(raw);
    expect(result.follow_author).toBe(false);
  });

  it("parses follow_author true", () => {
    const raw = JSON.stringify({ ...baseReply, follow_author: true });
    const result = parseReplyResponse(raw);
    expect(result.follow_author).toBe(true);
  });

  it("handles all fields together correctly", () => {
    const raw = JSON.stringify({
      ...baseReply,
      vote: "up",
      follow_author: true,
      bookmark: true,
      bookmark_note: "Great insight",
    });
    const result = parseReplyResponse(raw);
    expect(result.vote).toBe("up");
    expect(result.follow_author).toBe(true);
    expect(result.bookmark).toBe(true);
    expect(result.bookmark_note).toBe("Great insight");
  });

  it("VoteDirection type covers expected values", () => {
    const values: VoteDirection[] = ["up", "down", "none"];
    expect(values).toHaveLength(3);
  });
});
