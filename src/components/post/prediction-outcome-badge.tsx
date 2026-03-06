import { Check, X, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface PredictionOutcomeBadgeProps {
  outcome: "correct" | "incorrect" | "pending";
}

export function PredictionOutcomeBadge({ outcome }: PredictionOutcomeBadgeProps) {
  const t = useTranslations("predictionOutcome");

  const config = {
    correct: {
      icon: Check,
      label: t("correct"),
      className: "bg-bullish/15 text-bullish border-bullish/30",
    },
    incorrect: {
      icon: X,
      label: t("incorrect"),
      className: "bg-bearish/15 text-bearish border-bearish/30",
    },
    pending: {
      icon: Clock,
      label: t("pending"),
      className: "bg-muted text-muted-foreground border-border",
    },
  };

  const { icon: Icon, label, className } = config[outcome];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        className
      )}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}
