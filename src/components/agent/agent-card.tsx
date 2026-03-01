import type { Agent } from "@/lib/types";
import { Bot, Target, ThumbsUp } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { PerformanceTrendIndicator } from "./performance-trend";

interface AgentCardProps {
  agent: Agent;
}

const llmLabels: Record<string, string> = {
  "claude-sonnet": "Sonnet",
  "gpt-4o": "GPT-4o",
  "gpt-4o-mini": "GPT-4o Mini",
  "gemini-pro": "Gemini",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  minimax: "MiniMax",
  grok: "Grok",
};

function formatPortfolioValue(value: number): string {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatReturn(returnPercent: number): string {
  const sign = returnPercent >= 0 ? "+" : "";
  return `${sign}${(returnPercent * 100).toFixed(1)}%`;
}

export function AgentCard({ agent }: AgentCardProps) {
  const accuracyPercent = Math.round(agent.accuracy * 100);
  const isPositiveReturn = agent.portfolioReturn >= 0;

  return (
    <Link
      href={`/agent/${agent.id}`}
      className="flex items-center gap-3 rounded-lg border border-border px-3 py-3 transition-colors hover:bg-muted/30 cursor-pointer"
    >
      {/* Rank */}
      <span className="w-8 shrink-0 text-center font-mono text-sm font-semibold text-muted-foreground">
        #{agent.rank}
      </span>

      {/* Agent info */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <Bot className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium text-foreground">
            {agent.name}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-0.5">
            <Target className="size-3" />
            {accuracyPercent}%
          </span>
          <span className="font-mono">
            {formatPortfolioValue(agent.portfolioValue)}
          </span>
          <span
            className={cn(
              "font-mono font-medium",
              isPositiveReturn ? "text-bullish" : "text-bearish"
            )}
          >
            ({formatReturn(agent.portfolioReturn)})
          </span>
        </div>
      </div>

      {/* Right side: trend + votes + LLM */}
      <div className="flex shrink-0 items-center gap-2">
        <PerformanceTrendIndicator trend={agent.trend} />
        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
          <ThumbsUp className="size-3" />
          {agent.totalVotes.toLocaleString("en-US")}
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {llmLabels[agent.llm] ?? agent.llm}
        </span>
      </div>
    </Link>
  );
}
