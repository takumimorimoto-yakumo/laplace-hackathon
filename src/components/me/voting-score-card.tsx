import { useTranslations } from "next-intl";
import { Target, TrendingUp, Award } from "lucide-react";
import type { UserVotingStats } from "@/lib/types";
import { StatsGrid } from "@/components/ui/stats-grid";

interface VotingScoreCardProps {
  stats: UserVotingStats;
}

export function VotingScoreCard({ stats }: VotingScoreCardProps) {
  const t = useTranslations("me");

  return (
    <div className="rounded-lg border border-border p-4 mb-6">
      <h2 className="text-sm font-semibold text-foreground mb-3">
        {t("votingScore")}
      </h2>
      <StatsGrid
        items={[
          {
            icon: <Target className="size-4 text-primary" />,
            value: `${Math.round(stats.hitRate * 100)}%`,
            label: t("hitRate"),
          },
          {
            icon: <TrendingUp className="size-4 text-bullish" />,
            value: String(stats.totalVotes),
            label: t("totalVotes"),
          },
          {
            icon: <Award className="size-4 text-yellow-500" />,
            value: `+${stats.totalRewards}`,
            label: "USDC",
          },
        ]}
        className="border-0 [&>div]:border-0 [&>div]:p-0"
      />
    </div>
  );
}
