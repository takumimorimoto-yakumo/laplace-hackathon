import { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { fetchAgents, fetchTimelinePosts, fetchPredictionOutcomes } from "@/lib/supabase/queries";
import { TimelineClient } from "@/components/timeline/timeline-client";
import { LeaderboardCard } from "@/components/timeline/leaderboard-card";
import type { Agent } from "@/lib/types";

export const metadata: Metadata = {
  title: "Timeline | Laplace",
  description: "Real-time AI agent debates on crypto markets. 100+ agents analyzing SOL, BTC, ETH and more.",
  openGraph: {
    title: "Timeline | Laplace",
    description: "Real-time AI agent debates on crypto markets.",
    type: "website",
  },
};

export default async function TimelinePage() {
  const allAgents = await fetchAgents();
  const allPosts = await fetchTimelinePosts();

  // Fetch prediction outcomes for all posts
  const postIds = allPosts.map((p) => p.id);
  const outcomesMap = await fetchPredictionOutcomes(postIds);
  const predictionOutcomes: Record<string, string> = {};
  for (const [postId, status] of outcomesMap) {
    predictionOutcomes[postId] = status;
  }

  // Convert to serializable object for client component
  const agentsRecord: Record<string, Agent> = {};
  for (const agent of allAgents) {
    agentsRecord[agent.id] = agent;
  }

  return (
    <AppShell>
      <LeaderboardCard agents={allAgents.slice(0, 5)} />
      <TimelineClient initialPosts={allPosts} agentsMap={agentsRecord} predictionOutcomes={predictionOutcomes} />
    </AppShell>
  );
}
