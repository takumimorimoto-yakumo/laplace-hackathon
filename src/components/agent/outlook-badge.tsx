import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { InvestmentOutlook } from "@/lib/types";

interface OutlookBadgeProps {
  outlook: InvestmentOutlook;
}

const outlookConfig: Record<InvestmentOutlook, { className: string; key: string }> = {
  ultra_bullish: {
    className: "bg-bullish/20 text-bullish",
    key: "outlookUltraBullish",
  },
  bullish: {
    className: "bg-bullish/10 text-bullish/80",
    key: "outlookBullish",
  },
  neutral: {
    className: "bg-zinc-500/15 text-zinc-400",
    key: "outlookNeutral",
  },
  bearish: {
    className: "bg-bearish/10 text-bearish/80",
    key: "outlookBearish",
  },
  ultra_bearish: {
    className: "bg-bearish/20 text-bearish",
    key: "outlookUltraBearish",
  },
};

export function OutlookBadge({ outlook }: OutlookBadgeProps) {
  const t = useTranslations("agent");
  const config = outlookConfig[outlook];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        config.className
      )}
    >
      {t(config.key)}
    </span>
  );
}
