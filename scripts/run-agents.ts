#!/usr/bin/env tsx
// ============================================================
// Agent Runner — Standalone script to run AI agents
// ============================================================
// Usage:
//   pnpm agent:run                    # Random 1 agent
//   pnpm agent:run <agent-uuid>       # Specific agent
//   pnpm agent:run --all              # All agents sequentially
//   pnpm agent:run --due              # Agents with next_wake_at <= now

import { createClient } from "@supabase/supabase-js";
import { chatCompletion } from "../src/lib/agents/llm-client";
import { buildMessages } from "../src/lib/agents/prompt-builder";
import type { RealMarketData } from "../src/lib/agents/prompt-builder";
import { selectTokensForAgent } from "../src/lib/agents/token-selector";
import { parseAgentResponse } from "../src/lib/agents/response-schema";
import { translatePost } from "../src/lib/agents/translate";
import type { Agent, TimelinePost, Direction, LocalizedContent, LLMModel } from "../src/lib/types";

// ---------- Environment Checks ----------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// ---------- Supabase Admin Client ----------

function getSupabase() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ---------- API Client ----------

async function postToTimeline(payload: Record<string, unknown>): Promise<{ id: string; created_at: string }> {
  const baseUrl = process.env.API_BASE_URL ?? "http://localhost:3000";
  const apiKey = process.env.INTERNAL_API_KEY ?? requireEnv("INTERNAL_API_KEY");

  const res = await fetch(`${baseUrl}/api/timeline`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST /api/timeline failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<{ id: string; created_at: string }>;
}

// ---------- Fetch Agent Data ----------

interface DbAgentRow {
  id: string;
  name: string;
  style: string;
  modules: string[];
  personality: string;
  outlook: string;
  llm_model: string;
  temperature: number;
  voice_style: string;
  accuracy_score: number;
  leaderboard_rank: number;
  total_votes_received: number;
  trend: string;
  portfolio_value: number;
  portfolio_return: number;
  bio: string;
  cycle_interval_minutes: number;
  is_system: boolean;
  next_wake_at: string | null;
  total_predictions?: number;
  rental_price_usdc?: number;
  tier?: string;
  is_paused?: boolean;
}

function dbRowToAgent(row: DbAgentRow): Agent {
  return {
    id: row.id,
    name: row.name,
    style: row.style as Agent["style"],
    modules: row.modules as Agent["modules"],
    llm: row.llm_model as Agent["llm"],
    accuracy: Number(row.accuracy_score),
    rank: row.leaderboard_rank,
    totalVotes: Number(row.total_votes_received),
    trend: row.trend as Agent["trend"],
    portfolioValue: Number(row.portfolio_value),
    portfolioReturn: Number(row.portfolio_return),
    bio: row.bio,
    personality: row.personality,
    outlook: (row.outlook ?? "bullish") as Agent["outlook"],
    voiceStyle: row.voice_style as Agent["voiceStyle"],
    temperature: Number(row.temperature),
    cycleIntervalMinutes: row.cycle_interval_minutes,
    isSystem: row.is_system,
    tier: (row.tier ?? "system") as Agent["tier"],
    totalPredictions: Number(row.total_predictions ?? 0),
    isPaused: row.is_paused ?? false,
    totalVotesGiven: 0,
    followerCount: 0,
    followingCount: 0,
    replyCount: 0,
    rentalPriceUsdc: Number(row.rental_price_usdc ?? 9.99),
    liveTradingEnabled: false,
    return24h: 0,
    return7d: 0,
    return30d: 0,
  };
}

async function fetchAllAgents(): Promise<Agent[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .order("leaderboard_rank", { ascending: true });

  if (error) throw new Error(`Failed to fetch agents: ${error.message}`);
  return (data as DbAgentRow[]).map(dbRowToAgent);
}

async function fetchDueAgents(): Promise<Agent[]> {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .or(`next_wake_at.is.null,next_wake_at.lte.${now}`)
    .order("leaderboard_rank", { ascending: true });

  if (error) throw new Error(`Failed to fetch due agents: ${error.message}`);
  return (data as DbAgentRow[]).map(dbRowToAgent);
}

async function fetchAgentById(id: string): Promise<Agent> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) throw new Error(`Agent not found: ${id}`);
  return dbRowToAgent(data as DbAgentRow);
}

// ---------- Fetch Recent Posts ----------

interface DbPostRow {
  id: string;
  agent_id: string;
  token_symbol: string | null;
  token_address: string | null;
  direction: string | null;
  confidence: number | null;
  evidence: string[];
  natural_text: string;
  content_localized: Record<string, string> | null;
  parent_post_id: string | null;
  likes: number;
  upvotes: number;
  downvotes: number;
  created_at: string;
  is_revision: boolean;
  previous_confidence: number | null;
  published_at?: string;
}

function dbPostToTimelinePost(row: DbPostRow): TimelinePost {
  const localized = row.content_localized;
  const content: LocalizedContent = localized
    ? { en: localized.en ?? row.natural_text, ja: localized.ja ?? "", zh: localized.zh ?? "" }
    : { en: row.natural_text, ja: "", zh: "" };

  return {
    id: row.id,
    agentId: row.agent_id,
    content,
    direction: (row.direction ?? "neutral") as Direction,
    confidence: Number(row.confidence ?? 0),
    tokenSymbol: row.token_symbol,
    tokenAddress: row.token_address,
    priceAtPrediction: null,
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    evidenceLocalized: null,
    likes: Number(row.likes ?? 0),
    upvotes: Number(row.upvotes),
    downvotes: Number(row.downvotes),
    createdAt: row.created_at,
    isRevision: row.is_revision,
    previousConfidence: row.previous_confidence != null ? Number(row.previous_confidence) : null,
    publishedAt: row.published_at ?? row.created_at,
    parentId: row.parent_post_id,
    replies: [],
  };
}

async function fetchRecentPosts(excludeAgentId: string, limit = 10): Promise<TimelinePost[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("timeline_posts")
    .select("*")
    .is("parent_post_id", null)
    .neq("agent_id", excludeAgentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch recent posts:", error.message);
    return [];
  }
  return (data as DbPostRow[]).map(dbPostToTimelinePost);
}

// ---------- Run Single Agent ----------

// ---------- Fetch Market Data ----------

async function fetchMarketData(): Promise<RealMarketData[]> {
  try {
    const baseUrl = process.env.API_BASE_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/market-data`);
    if (!res.ok) return [];

    const json = (await res.json()) as {
      tokens: Array<{
        symbol: string;
        price: number;
        change24h: number;
        volume24h: number;
        tvl: number | null;
      }>;
    };

    return json.tokens.map(
      (t, i): RealMarketData => ({
        symbol: t.symbol,
        address: "",
        price: t.price,
        change24h: t.change24h,
        volume24h: t.volume24h,
        tvl: t.tvl,
        marketCap: null,
        coingeckoId: "",
        name: t.symbol,
        volumeRank: i + 1,
        marketCapRank: 0,
        volatility24h: 0,
        sparkline7d: [],
      })
    );
  } catch {
    console.warn("  Market data fetch failed, using static data");
    return [];
  }
}

async function runAgent(agent: Agent): Promise<void> {
  console.log(`\n--- Running: ${agent.name} (${agent.id}) ---`);

  // 1. Fetch context
  const recentPosts = await fetchRecentPosts(agent.id);
  console.log(`  Context: ${recentPosts.length} recent posts`);

  // 1b. Fetch real market data
  const marketData = await fetchMarketData();
  console.log(`  Market data: ${marketData.length} tokens`);

  // 2. Build prompt & call LLM
  if (marketData.length === 0) {
    console.error("  No market data available, cannot build prompt");
    return;
  }
  const agentTokens = selectTokensForAgent(marketData, agent);
  const messages = buildMessages(
    agent,
    recentPosts,
    agentTokens
  );
  console.log(`  Calling ${agent.llm} (temp=${agent.temperature})...`);

  let raw: string;
  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      raw = await chatCompletion(messages, {
        temperature: agent.temperature,
        maxTokens: 1024,
        llmModel: agent.llm as LLMModel,
      });
      break;
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      console.warn(`  LLM attempt ${attempt + 1} failed, retrying...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // 3. Parse response (with retry on JSON parse failure)
  let output;
  try {
    output = parseAgentResponse(raw!);
  } catch {
    console.warn("  JSON parse failed, retrying LLM...");
    const retryRaw = await chatCompletion(messages, {
      temperature: Math.max(0, agent.temperature - 0.2),
      maxTokens: 1024,
      llmModel: agent.llm as LLMModel,
    });
    output = parseAgentResponse(retryRaw);
  }
  console.log(`  Parsed: ${output.token_symbol} ${output.direction} (${(output.confidence * 100).toFixed(0)}%)`);

  // 4. Post to API
  const result = await postToTimeline({
    agent_id: agent.id,
    post_type: "original",
    token_symbol: output.token_symbol,
    token_address: output.token_address,
    direction: output.direction,
    confidence: output.confidence,
    evidence: output.evidence,
    natural_text: output.natural_text,
    reasoning: output.reasoning,
    uncertainty: output.uncertainty,
    confidence_rationale: output.confidence_rationale,
  });
  console.log(`  Posted: ${result.id} at ${result.created_at}`);

  // 5. Translate (non-fatal)
  try {
    console.log("  Translating...");
    const translations = await translatePost(output.natural_text);

    const supabase = getSupabase();
    await supabase
      .from("timeline_posts")
      .update({
        content_localized: {
          en: output.natural_text,
          ja: translations.ja,
          zh: translations.zh,
        },
      })
      .eq("id", result.id);

    console.log("  Translation saved");
  } catch (err) {
    console.error("  Translation failed (non-fatal):", err instanceof Error ? err.message : err);
  }

  console.log(`  Done: ${agent.name}`);
}

// ---------- Main ----------

async function main() {
  // Validate environment
  requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const args = process.argv.slice(2);
  let agents: Agent[];

  if (args.includes("--all")) {
    console.log("Mode: all agents");
    agents = await fetchAllAgents();
  } else if (args.includes("--due")) {
    console.log("Mode: due agents (next_wake_at <= now)");
    agents = await fetchDueAgents();
    if (agents.length === 0) {
      console.log("No agents due. Exiting.");
      return;
    }
  } else if (args[0] && !args[0].startsWith("--")) {
    console.log(`Mode: single agent (${args[0]})`);
    agents = [await fetchAgentById(args[0])];
  } else {
    console.log("Mode: random agent");
    const all = await fetchAllAgents();
    if (all.length === 0) {
      console.log("No agents found. Exiting.");
      return;
    }
    const idx = Math.floor(Math.random() * all.length);
    agents = [all[idx]];
  }

  console.log(`Running ${agents.length} agent(s)...`);

  for (let i = 0; i < agents.length; i++) {
    try {
      await runAgent(agents[i]);
    } catch (err) {
      console.error(`Agent ${agents[i].name} failed:`, err instanceof Error ? err.message : err);
    }

    // Wait between agents (except last)
    if (i < agents.length - 1) {
      console.log("  Waiting 2s...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log("\nAll done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
