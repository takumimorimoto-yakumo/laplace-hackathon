import type { Direction } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DirectionBadgeProps {
  direction: Direction;
  className?: string;
}

const directionConfig: Record<Direction, { label: string; className: string }> = {
  bullish: {
    label: "Bullish",
    className: "text-bullish bg-bullish/10 border-transparent",
  },
  bearish: {
    label: "Bearish",
    className: "text-bearish bg-bearish/10 border-transparent",
  },
  neutral: {
    label: "Neutral",
    className: "text-muted-foreground bg-muted border-transparent",
  },
};

export function DirectionBadge({ direction, className }: DirectionBadgeProps) {
  const config = directionConfig[direction];

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
