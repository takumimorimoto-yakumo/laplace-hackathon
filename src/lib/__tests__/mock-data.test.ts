import { describe, it, expect } from "vitest";
import {
  agents,
  timelinePosts,
  seedTokens,
  predictionContest,
  whaleTrackerPositions,
  whaleTrackerTrades,
  agentRentalPlans,
  getRentalPlanForAgent,
  thinkingProcesses,
  getThinkingProcess,
  newsItems,
  isProPicker,
  getProPickers,
  getAgent,
  getToken,
  getTokenBySymbol,
  getPostsForToken,
  formatPrice,
  formatChange,
  formatCompactNumber,
} from "../mock-data";

// -------------------------------------------------------
// Data integrity tests
// -------------------------------------------------------
describe("mock data integrity", () => {
  it("has 10 agents", () => {
    expect(agents).toHaveLength(10);
  });

  it("every agent has required fields", () => {
    for (const agent of agents) {
      expect(agent.id).toBeTruthy();
      expect(agent.name).toBeTruthy();
      expect(agent.accuracy).toBeGreaterThanOrEqual(0);
      expect(agent.accuracy).toBeLessThanOrEqual(1);
      expect(agent.rank).toBeGreaterThan(0);
      expect(agent.modules.length).toBeGreaterThan(0);
      expect(agent.bio).toBeTruthy();
    }
  });

  it("agent IDs are unique", () => {
    const ids = agents.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("agent ranks are unique and sequential", () => {
    const ranks = agents.map((a) => a.rank).sort((a, b) => a - b);
    expect(ranks).toEqual(Array.from({ length: agents.length }, (_, i) => i + 1));
  });

  it("has timeline posts", () => {
    expect(timelinePosts.length).toBeGreaterThan(0);
  });

  it("every post references a valid agent", () => {
    for (const post of timelinePosts) {
      expect(getAgent(post.agentId)).toBeDefined();
    }
  });

  it("top-level posts have parentId === null", () => {
    const topLevel = timelinePosts.filter((p) => p.parentId === null);
    expect(topLevel.length).toBeGreaterThan(0);
  });

  it("has seed tokens", () => {
    expect(seedTokens.length).toBeGreaterThan(0);
  });

  it("every seed token has valid bullishPercent (0-100)", () => {
    for (const token of seedTokens) {
      expect(token.bullishPercent).toBeGreaterThanOrEqual(0);
      expect(token.bullishPercent).toBeLessThanOrEqual(100);
    }
  });

  it("seed token addresses are unique", () => {
    const addrs = seedTokens.map((t) => t.address);
    expect(new Set(addrs).size).toBe(addrs.length);
  });

  it("every seed token has tags array", () => {
    for (const token of seedTokens) {
      expect(Array.isArray(token.tags)).toBe(true);
      expect(token.tags.length).toBeGreaterThan(0);
    }
  });

  it("prediction contest has entries", () => {
    expect(predictionContest.entries.length).toBeGreaterThan(0);
  });

  it("prediction contest entries reference valid agents", () => {
    for (const entry of predictionContest.entries) {
      expect(getAgent(entry.agentId)).toBeDefined();
    }
  });

  it("prediction contest firstPlaceProbability is 0-100", () => {
    for (const entry of predictionContest.entries) {
      expect(entry.firstPlaceProbability).toBeGreaterThanOrEqual(0);
      expect(entry.firstPlaceProbability).toBeLessThanOrEqual(100);
    }
  });

  it("prediction contest topThreeProbability is 0-100", () => {
    for (const entry of predictionContest.entries) {
      expect(entry.topThreeProbability).toBeGreaterThanOrEqual(0);
      expect(entry.topThreeProbability).toBeLessThanOrEqual(100);
    }
  });

  it("topThreeProbability >= firstPlaceProbability for every entry", () => {
    for (const entry of predictionContest.entries) {
      expect(entry.topThreeProbability).toBeGreaterThanOrEqual(entry.firstPlaceProbability);
    }
  });

  it("has whale tracker positions", () => {
    expect(whaleTrackerPositions.length).toBeGreaterThan(0);
  });

  it("has whale tracker trades", () => {
    expect(whaleTrackerTrades.length).toBeGreaterThan(0);
  });

  it("posts with tokenAddress have non-null priceAtPrediction", () => {
    function checkPosts(posts: typeof timelinePosts) {
      for (const post of posts) {
        if (post.tokenAddress !== null) {
          expect(post.priceAtPrediction).not.toBeNull();
          expect(typeof post.priceAtPrediction).toBe("number");
        }
        if (post.replies.length > 0) {
          checkPosts(post.replies);
        }
      }
    }
    checkPosts(timelinePosts);
  });

  it("posts without tokenAddress have null priceAtPrediction", () => {
    function checkPosts(posts: typeof timelinePosts) {
      for (const post of posts) {
        if (post.tokenAddress === null) {
          expect(post.priceAtPrediction).toBeNull();
        }
        if (post.replies.length > 0) {
          checkPosts(post.replies);
        }
      }
    }
    checkPosts(timelinePosts);
  });

  it("every seed token has priceHistory48h with 48 elements", () => {
    for (const token of seedTokens) {
      expect(token.priceHistory48h).toHaveLength(48);
    }
  });

  it("priceHistory48h last value equals current price", () => {
    for (const token of seedTokens) {
      expect(token.priceHistory48h[47]).toBe(token.price);
    }
  });
});

// -------------------------------------------------------
// Lookup helpers
// -------------------------------------------------------
describe("getAgent", () => {
  it("returns agent by id", () => {
    const agent = getAgent("agent-001");
    expect(agent).toBeDefined();
    expect(agent!.name).toBe("DeFi Yield Hunter");
  });

  it("returns undefined for unknown id", () => {
    expect(getAgent("nonexistent")).toBeUndefined();
  });
});

describe("getToken", () => {
  it("returns token by address", () => {
    const token = getToken("So11111111111111111111111111111111111111112");
    expect(token).toBeDefined();
    expect(token!.symbol).toBe("SOL");
  });

  it("returns undefined for unknown address", () => {
    expect(getToken("unknown-address")).toBeUndefined();
  });
});

describe("getTokenBySymbol", () => {
  it("returns token by symbol", () => {
    const token = getTokenBySymbol("SOL");
    expect(token).toBeDefined();
    expect(token!.name).toBe("Solana");
  });

  it("returns undefined for unknown symbol", () => {
    expect(getTokenBySymbol("FAKE")).toBeUndefined();
  });
});

// -------------------------------------------------------
// Formatting helpers
// -------------------------------------------------------
describe("formatPrice", () => {
  it("formats prices >= 100 with 2 decimals", () => {
    expect(formatPrice(123.456)).toBe("$123.46");
  });

  it("formats prices < 100 with 2 decimals", () => {
    expect(formatPrice(45.678)).toBe("$45.68");
  });

  it("formats prices < 1 with 4 decimals", () => {
    expect(formatPrice(0.5678)).toBe("$0.5678");
  });

  it("formats very small prices with 7 decimals", () => {
    expect(formatPrice(0.0001234)).toBe("$0.0001234");
  });
});

describe("formatChange", () => {
  it("formats positive change with + sign", () => {
    expect(formatChange(5.3)).toBe("+5.3%");
  });

  it("formats negative change with - sign", () => {
    expect(formatChange(-3.2)).toBe("-3.2%");
  });

  it("formats zero change with + sign", () => {
    expect(formatChange(0)).toBe("+0.0%");
  });
});

describe("formatCompactNumber", () => {
  it("formats billions", () => {
    expect(formatCompactNumber(8_200_000_000)).toBe("$8.2B");
  });

  it("formats millions", () => {
    expect(formatCompactNumber(3_100_000)).toBe("$3M");
  });

  it("formats thousands", () => {
    expect(formatCompactNumber(14_230)).toBe("$14K");
  });

  it("formats small numbers", () => {
    expect(formatCompactNumber(500)).toBe("$500");
  });
});

// -------------------------------------------------------
// getPostsForToken
// -------------------------------------------------------
describe("getPostsForToken", () => {
  it("returns posts for JUP token including replies", () => {
    const jupPosts = getPostsForToken("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN");
    expect(jupPosts.length).toBeGreaterThan(0);
    // Should include replies (post-002, post-003 are replies about JUP)
    const ids = jupPosts.map((p) => p.id);
    expect(ids).toContain("post-002");
    expect(ids).toContain("post-003");
  });

  it("returns empty array for unknown token", () => {
    const posts = getPostsForToken("unknown-address");
    expect(posts).toHaveLength(0);
  });

  it("every returned post references the requested token", () => {
    const solPosts = getPostsForToken("So11111111111111111111111111111111111111112");
    for (const post of solPosts) {
      expect(post.tokenAddress).toBe("So11111111111111111111111111111111111111112");
    }
  });
});

// -------------------------------------------------------
// Rental plans
// -------------------------------------------------------
describe("rental plans", () => {
  it("every agent has exactly 1 rental plan", () => {
    for (const agent of agents) {
      const plan = getRentalPlanForAgent(agent.id);
      expect(plan).toBeDefined();
    }
  });

  it("total rental plans equals number of agents", () => {
    expect(agentRentalPlans).toHaveLength(agents.length);
  });

  it("all rental plans have positive monthly price", () => {
    for (const plan of agentRentalPlans) {
      expect(plan.monthlyPriceUsdc).toBeGreaterThan(0);
    }
  });

  it("all rental plans reference valid agents", () => {
    for (const plan of agentRentalPlans) {
      expect(getAgent(plan.agentId)).toBeDefined();
    }
  });
});

// -------------------------------------------------------
// Thinking processes
// -------------------------------------------------------
describe("thinking processes", () => {
  it("every thinking process references a valid post ID", () => {
    const allPostIds = new Set<string>();
    function collectIds(posts: typeof timelinePosts) {
      for (const post of posts) {
        allPostIds.add(post.id);
        if (post.replies.length > 0) collectIds(post.replies);
      }
    }
    collectIds(timelinePosts);

    for (const tp of thinkingProcesses) {
      expect(allPostIds.has(tp.postId)).toBe(true);
    }
  });

  it("getThinkingProcess returns correct process", () => {
    const tp = getThinkingProcess("post-001");
    expect(tp).toBeDefined();
    expect(tp!.consensus.length).toBeGreaterThan(0);
  });

  it("getThinkingProcess returns undefined for unknown post", () => {
    expect(getThinkingProcess("nonexistent")).toBeUndefined();
  });

  it("every LocalizedContent in thinking processes has all 3 languages", () => {
    for (const tp of thinkingProcesses) {
      for (const item of [...tp.consensus, ...tp.debatePoints, ...tp.blindSpots]) {
        expect(item.en).toBeTruthy();
        expect(item.ja).toBeTruthy();
        expect(item.zh).toBeTruthy();
      }
    }
  });
});

// -------------------------------------------------------
// News items
// -------------------------------------------------------
describe("news items", () => {
  it("news item IDs are unique", () => {
    const ids = newsItems.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every news item has LocalizedContent with all 3 languages", () => {
    for (const item of newsItems) {
      expect(item.title.en).toBeTruthy();
      expect(item.title.ja).toBeTruthy();
      expect(item.title.zh).toBeTruthy();
    }
  });

  it("has at least 5 news items", () => {
    expect(newsItems.length).toBeGreaterThanOrEqual(5);
  });

  it("every news item references a valid agent as author", () => {
    for (const item of newsItems) {
      expect(getAgent(item.authorAgentId)).toBeDefined();
    }
  });

  it("every news author is a Pro Picker", () => {
    for (const item of newsItems) {
      const author = getAgent(item.authorAgentId)!;
      expect(isProPicker(author)).toBe(true);
    }
  });
});

// -------------------------------------------------------
// Pro Picker
// -------------------------------------------------------
describe("pro picker", () => {
  it("returns 9 pro pickers (Meme Hunter excluded)", () => {
    const pickers = getProPickers();
    expect(pickers).toHaveLength(9);
  });

  it("excludes agents with accuracy below 60%", () => {
    const memeHunter = getAgent("agent-010")!;
    expect(memeHunter.accuracy).toBeLessThan(0.6);
    expect(isProPicker(memeHunter)).toBe(false);
  });

  it("includes top-ranked agents with sufficient accuracy", () => {
    const defiHunter = getAgent("agent-001")!;
    expect(isProPicker(defiHunter)).toBe(true);
  });

  it("all pro pickers have rank <= 10 and accuracy >= 0.6", () => {
    for (const picker of getProPickers()) {
      expect(picker.rank).toBeLessThanOrEqual(10);
      expect(picker.accuracy).toBeGreaterThanOrEqual(0.6);
    }
  });
});
