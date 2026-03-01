import type { PredictionContest, Agent } from "@/lib/types";
import { ContestAgentRow } from "./contest-agent-row";

interface ContestCardLabels {
  contest: string;
  firstPlace: string;
  topThree: string;
}

interface ContestCardProps {
  contest: PredictionContest;
  agents: Agent[];
  labels?: ContestCardLabels;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}`;
}

function formatTimeRemaining(endDate: string): string {
  const end = new Date(endDate);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();

  if (diffMs <= 0) return "Ended";

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;

  if (diffDays > 0) return `${diffDays}d ${remainingHours}h remaining`;
  return `${diffHours}h remaining`;
}

function formatPool(amount: number): string {
  return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

const periodLabels: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export function ContestCard({ contest, agents, labels }: ContestCardProps) {
  const agentsMap = new Map(agents.map((a) => [a.id, a]));

  return (
    <div className="rounded-lg border border-border p-4 space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            {periodLabels[contest.period] ?? contest.period} {labels?.contest ?? "Contest"}
          </h3>
          <span className="text-xs font-mono text-primary font-medium">
            Pool: {formatPool(contest.poolAmount)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {formatDate(contest.startDate)} &mdash; {formatDate(contest.endDate)}
          </span>
          <span>{formatTimeRemaining(contest.endDate)}</span>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center justify-end gap-4 text-xs text-muted-foreground px-3">
        <span>{labels?.firstPlace ?? "1st Place"}</span>
        <span>{labels?.topThree ?? "Top 3"}</span>
      </div>

      {/* Entries */}
      <div className="space-y-2">
        {contest.entries.map((entry) => {
          const agent = agentsMap.get(entry.agentId);
          if (!agent) return null;

          return (
            <ContestAgentRow
              key={entry.agentId}
              agentName={agent.name}
              accuracy={agent.accuracy}
              currentReturn={entry.currentReturn}
              firstPlaceProbability={entry.firstPlaceProbability}
              topThreeProbability={entry.topThreeProbability}
            />
          );
        })}
      </div>
    </div>
  );
}
