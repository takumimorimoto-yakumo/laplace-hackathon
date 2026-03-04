"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserVotingStats } from "@/lib/types";

const EMPTY_STATS: UserVotingStats = {
  totalVotes: 0,
  correctVotes: 0,
  hitRate: 0,
  totalRewards: 0,
};

export function useUserVotingStats(walletAddress: string | null) {
  const [stats, setStats] = useState<UserVotingStats>(EMPTY_STATS);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!walletAddress) return;

    let cancelled = false;

    supabase
      .from("positions")
      .select("is_correct, settlement")
      .eq("predictor_wallet", walletAddress)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // Silently ignore missing table (migration not yet applied)
          if (!error.message.includes("schema cache")) {
            console.error("Failed to fetch voting stats:", error.message);
          }
        } else {
          const rows = data ?? [];
          const totalVotes = rows.length;
          const correctVotes = rows.filter((r) => r.is_correct === true).length;
          const hitRate = totalVotes > 0 ? correctVotes / totalVotes : 0;
          const totalRewards = rows.reduce(
            (sum, r) => sum + (Number(r.settlement) || 0),
            0
          );
          setStats({ totalVotes, correctVotes, hitRate, totalRewards });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [walletAddress, supabase]);

  return { stats };
}
