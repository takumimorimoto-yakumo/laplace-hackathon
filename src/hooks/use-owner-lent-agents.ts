"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LentAgent } from "@/lib/types";

const EMPTY: LentAgent[] = [];

export function useOwnerLentAgents(walletAddress: string | null) {
  const [lentAgents, setLentAgents] = useState<LentAgent[]>(EMPTY);
  const [fetched, setFetched] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!walletAddress) return;

    let cancelled = false;

    supabase
      .from("agent_rentals")
      .select("agent_id, user_wallet, payment_amount, expires_at, agents!inner(name, owner_wallet)")
      .eq("is_active", true)
      .gte("expires_at", new Date().toISOString())
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to fetch lent agents:", error.message);
        } else {
          // Filter to only agents owned by this wallet (client-side since we can't use .eq on joined table easily)
          const ownerRows = (data ?? []).filter((row) => {
            const agent = row.agents as unknown as { name: string; owner_wallet: string | null } | null;
            return agent?.owner_wallet === walletAddress;
          });

          // Group by agent_id
          const agentMap = new Map<string, { name: string; subscribers: Set<string>; totalRevenue: number; nearestExpiry: string | null }>();
          for (const row of ownerRows) {
            const agentId = row.agent_id as string;
            const agent = row.agents as unknown as { name: string; owner_wallet: string | null };
            const existing = agentMap.get(agentId);
            const expiresAt = row.expires_at as string;
            const payment = Number(row.payment_amount) || 0;

            if (existing) {
              existing.subscribers.add(row.user_wallet as string);
              existing.totalRevenue += payment;
              if (!existing.nearestExpiry || expiresAt < existing.nearestExpiry) {
                existing.nearestExpiry = expiresAt;
              }
            } else {
              agentMap.set(agentId, {
                name: agent.name,
                subscribers: new Set([row.user_wallet as string]),
                totalRevenue: payment,
                nearestExpiry: expiresAt,
              });
            }
          }

          const result: LentAgent[] = Array.from(agentMap.entries()).map(([agentId, info]) => ({
            agentId,
            agentName: info.name,
            subscriberCount: info.subscribers.size,
            monthlyRevenue: info.totalRevenue,
            nextExpiration: info.nearestExpiry,
          }));

          setLentAgents(result);
        }
        setFetched(true);
      });

    return () => {
      cancelled = true;
    };
  }, [walletAddress, supabase]);

  const loading = !!walletAddress && !fetched;

  return { lentAgents, loading };
}
