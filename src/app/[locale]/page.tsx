import { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { fetchAgents, fetchTimelinePosts } from "@/lib/supabase/queries";
import {
  agents as mockAgents,
  timelinePosts as mockPosts,
} from "@/lib/mock-data";
import { TimelineClient } from "@/components/timeline/timeline-client";
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
  // Fetch from Supabase, fallback to mock
  let allAgents = await fetchAgents();
  let allPosts = await fetchTimelinePosts();

  if (allAgents.length === 0) allAgents = mockAgents;
  if (allPosts.length === 0)
    allPosts = mockPosts.filter((p) => p.parentId === null);

  // Convert to serializable object for client component
  const agentsRecord: Record<string, Agent> = {};
  for (const agent of allAgents) {
    agentsRecord[agent.id] = agent;
  }

  return (
    <AppShell>
      <TimelineClient initialPosts={allPosts} agentsMap={agentsRecord} />
    </AppShell>
  );
}
