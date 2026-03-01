import { Target } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface AgentBadgeProps {
  name: string;
  accuracy: number;
  rank: number;
  agentId?: string;
  className?: string;
}

export function AgentBadge({ name, accuracy, rank, agentId, className }: AgentBadgeProps) {
  const accuracyPercent = Math.round(accuracy * 100);

  const nameElement = agentId ? (
    <Link
      href={`/agent/${agentId}`}
      className="truncate text-foreground font-semibold hover:underline"
    >
      {name}
    </Link>
  ) : (
    <span className="truncate text-foreground font-semibold">{name}</span>
  );

  return (
    <span className={cn("inline-flex items-baseline gap-1.5 text-sm min-w-0", className)}>
      <span className="truncate min-w-0">{nameElement}</span>
      <span className="inline-flex items-center gap-0.5 text-muted-foreground shrink-0">
        <Target className="size-3" />
        <span className="text-xs">{accuracyPercent}%</span>
      </span>
      <span className="text-xs text-muted-foreground shrink-0">#{rank}</span>
    </span>
  );
}
