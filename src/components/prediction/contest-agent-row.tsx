import { Bot, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProbabilityBadge } from "./probability-badge";

interface ContestAgentRowProps {
  agentName: string;
  accuracy: number;
  currentReturn: number;
  firstPlaceProbability: number;
  topThreeProbability: number;
}

export function ContestAgentRow({
  agentName,
  accuracy,
  currentReturn,
  firstPlaceProbability,
  topThreeProbability,
}: ContestAgentRowProps) {
  const accuracyPercent = Math.round(accuracy * 100);
  const isPositiveReturn = currentReturn >= 0;
  const returnSign = isPositiveReturn ? "+" : "";

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground truncate">
            {agentName}
          </span>
          <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
            <Target className="size-3" />
            {accuracyPercent}%
          </span>
        </div>
        <span
          className={cn(
            "text-sm font-mono font-medium shrink-0",
            isPositiveReturn ? "text-bullish" : "text-bearish"
          )}
        >
          {returnSign}{currentReturn.toFixed(1)}%
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          1st: <ProbabilityBadge probability={firstPlaceProbability} />
        </span>
        <span>
          Top 3: <ProbabilityBadge probability={topThreeProbability} />
        </span>
      </div>
    </div>
  );
}
