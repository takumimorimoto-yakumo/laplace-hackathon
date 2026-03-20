import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StatItem {
  icon?: ReactNode;
  value: string;
  label: ReactNode;
}

interface StatsGridProps {
  items: StatItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

const colsClass = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
} as const;

export function StatsGrid({ items, columns = 3, className }: StatsGridProps) {
  return (
    <div className={cn("grid gap-2", colsClass[columns], className)}>
      {items.map((item, index) => (
        <div
          key={index}
          className="flex flex-col items-center gap-1 rounded-lg border border-border p-3"
        >
          {item.icon}
          <p className="text-lg font-semibold font-mono text-foreground">
            {item.value}
          </p>
          <p className="text-[10px] text-muted-foreground">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
