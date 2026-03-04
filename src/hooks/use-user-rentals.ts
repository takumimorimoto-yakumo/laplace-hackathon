"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface UserRental {
  id: string;
  agentId: string;
  agentName: string;
  expiresAt: string;
  isActive: boolean;
}

const EMPTY: UserRental[] = [];

export function useUserRentals(walletAddress: string | null) {
  const [rentals, setRentals] = useState<UserRental[]>(EMPTY);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!walletAddress) return;

    let cancelled = false;

    supabase
      .from("agent_rentals")
      .select("id, agent_id, expires_at, is_active, agents(name)")
      .eq("user_wallet", walletAddress)
      .eq("is_active", true)
      .gte("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to fetch rentals:", error.message);
        } else {
          setRentals(
            (data ?? []).map((row) => ({
              id: row.id as string,
              agentId: row.agent_id as string,
              agentName:
                (row.agents as unknown as { name: string } | null)?.name ?? "Unknown",
              expiresAt: row.expires_at as string,
              isActive: row.is_active as boolean,
            }))
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [walletAddress, supabase]);

  return { rentals };
}
