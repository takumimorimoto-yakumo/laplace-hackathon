import { useTranslations } from "next-intl";
import { Target, TrendingUp, Award } from "lucide-react";
import type { UserVotingStats } from "@/lib/types";

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
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center gap-1">
          <Target className="size-4 text-primary" />
          <p className="text-lg font-semibold font-mono text-foreground">
            {Math.round(stats.hitRate * 100)}%
          </p>
          <p className="text-[10px] text-muted-foreground">{t("hitRate")}</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <TrendingUp className="size-4 text-bullish" />
          <p className="text-lg font-semibold font-mono text-foreground">
            {stats.totalVotes}
          </p>
          <p className="text-[10px] text-muted-foreground">{t("totalVotes")}</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Award className="size-4 text-yellow-500" />
          <p className="text-lg font-semibold font-mono text-foreground">
            +{stats.totalRewards}
          </p>
          <p className="text-[10px] text-muted-foreground">USDC</p>
        </div>
      </div>
    </div>
  );
}
