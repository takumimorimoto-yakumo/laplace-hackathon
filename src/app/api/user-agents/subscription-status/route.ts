import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest } from "@/lib/api/errors";
import type { AgentSubscriptionStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

interface AgentStatusItem {
  agentId: string;
  agentName: string;
  status: AgentSubscriptionStatus;
  expiresAt: string | null;
}

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return badRequest("wallet parameter is required");
  }

  const supabase = createAdminClient();

  const { data: agents, error: agentsError } = await supabase
    .from("agents")
    .select("id, name, created_at")
    .eq("owner_wallet", wallet)
    .eq("tier", "user")
    .order("created_at", { ascending: true });

  if (agentsError || !agents || agents.length === 0) {
    return NextResponse.json({ agents: [] });
  }

  const result: AgentStatusItem[] = [];

  // Check if agent_subscriptions table exists by attempting a query
  let subscriptionsAvailable = true;

  for (const agent of agents) {
    if (subscriptionsAvailable) {
      // Check for active subscription (trial or paid)
      const { data: sub, error: subError } = await supabase
        .from("agent_subscriptions")
        .select("expires_at, is_trial")
        .eq("agent_id", agent.id)
        .eq("is_active", true)
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError) {
        console.warn("agent_subscriptions query failed:", subError.message);
        subscriptionsAvailable = false;
      } else if (sub && new Date(sub.expires_at as string) > new Date()) {
        result.push({
          agentId: agent.id as string,
          agentName: agent.name as string,
          status: (sub.is_trial as boolean) ? "trial" : "active",
          expiresAt: sub.expires_at as string,
        });
        continue;
      }
    }

    result.push({
      agentId: agent.id as string,
      agentName: agent.name as string,
      status: "expired",
      expiresAt: null,
    });
  }

  return NextResponse.json({ agents: result });
}
