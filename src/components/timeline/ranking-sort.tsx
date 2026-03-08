"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Trophy,
  TrendingUp,
  Target,
  Users,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type RankingSortField =
  | "rank"
  | "return"
  | "accuracy"
  | "followers"
  | "predictions";

interface RankingSortProps {
  sortBy: RankingSortField;
  onSortChange: (sort: RankingSortField) => void;
}

const sortOptions: {
  value: RankingSortField;
  labelKey: string;
  icon: typeof Trophy;
}[] = [
  { value: "rank", labelKey: "sortRank", icon: Trophy },
  { value: "return", labelKey: "sortReturn", icon: TrendingUp },
  { value: "accuracy", labelKey: "sortAccuracy", icon: Target },
  { value: "followers", labelKey: "sortFollowers", icon: Users },
  { value: "predictions", labelKey: "sortPredictions", icon: BarChart3 },
];

export function RankingSort({ sortBy, onSortChange }: RankingSortProps) {
  const t = useTranslations("leaderboard");
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    const activeEl = itemRefs.current.get(sortBy);
    const container = scrollRef.current;
    if (activeEl && container) {
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      setIndicatorStyle({
        left: activeRect.left - containerRect.left + container.scrollLeft,
        width: activeRect.width,
      });
    }
  }, [sortBy]);

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useEffect(() => {
    const activeEl = itemRefs.current.get(sortBy);
    activeEl?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [sortBy]);

  return (
    <div className="border-b border-border bg-background/60 backdrop-blur-sm">
      <div
        ref={scrollRef}
        className="relative flex gap-1.5 overflow-x-auto px-3 py-2 scrollbar-hide"
      >
        {/* Sliding indicator */}
        <div
          className="absolute bottom-2 h-[calc(100%-16px)] rounded-lg bg-primary/15 transition-all duration-200 ease-out"
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
          }}
        />

        {sortOptions.map(({ value, labelKey, icon: Icon }) => {
          const isActive = sortBy === value;
          return (
            <button
              key={value}
              ref={(el) => {
                if (el) itemRefs.current.set(value, el);
              }}
              onClick={() => onSortChange(value)}
              className={cn(
                "relative z-10 flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5",
                "text-xs font-medium transition-colors duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("size-3.5", isActive && "text-primary")} />
              <span className="whitespace-nowrap">{t(labelKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
