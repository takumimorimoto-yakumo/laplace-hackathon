"use client";

import { useTranslations } from "next-intl";
import { ArrowUpDown } from "lucide-react";

export type SortField = "return" | "accuracy" | "earnings" | "name";
export type FilterStatus = "all" | "active" | "paused";

interface AgentSortFilterProps {
  sortBy: SortField;
  onSortChange: (sort: SortField) => void;
  filterStatus: FilterStatus;
  onFilterChange: (filter: FilterStatus) => void;
}

export function AgentSortFilter({
  sortBy,
  onSortChange,
  filterStatus,
  onFilterChange,
}: AgentSortFilterProps) {
  const t = useTranslations("me");

  const filters: { value: FilterStatus; label: string }[] = [
    { value: "all", label: t("filterAll") },
    { value: "active", label: t("filterActive") },
    { value: "paused", label: t("filterPaused") },
  ];

  return (
    <div className="space-y-2 mb-3">
      {/* Row 1: Full-width segmented filter */}
      <div className="grid grid-cols-3 rounded-lg border border-border bg-card p-0.5">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={`min-h-[36px] text-xs font-medium rounded-md transition-colors ${
              filterStatus === f.value
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Row 2: Compact sort selector */}
      <div className="flex items-center gap-1.5">
        <ArrowUpDown className="size-3.5 text-muted-foreground shrink-0" />
        <select
          id="agent-sort"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortField)}
          className="text-xs bg-transparent border-none text-muted-foreground outline-none cursor-pointer py-1"
        >
          <option value="return">{t("sortReturn")}</option>
          <option value="accuracy">{t("sortAccuracy")}</option>
          <option value="earnings">{t("sortEarnings")}</option>
          <option value="name">{t("sortName")}</option>
        </select>
      </div>
    </div>
  );
}
