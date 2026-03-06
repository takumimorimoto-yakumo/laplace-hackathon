"use client";

import type { Direction } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const directionStyles: Record<Direction, string> = {
  bullish: "text-bullish bg-bullish/10 border-transparent",
  bearish: "text-bearish bg-bearish/10 border-transparent",
  neutral: "text-muted-foreground bg-muted border-transparent",
};

interface DirectionBadgeProps {
  direction: Direction;
  className?: string;
}

export function DirectionBadge({ direction, className }: DirectionBadgeProps) {
  const t = useTranslations("token");
  return (
    <Badge variant="outline" className={cn(directionStyles[direction], className)}>
      {t(direction)}
    </Badge>
  );
}
