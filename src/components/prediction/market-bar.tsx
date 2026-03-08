"use client";

import { useTranslations } from "next-intl";

interface MarketBarProps {
  yesPercent: number;
  poolYes?: number;
  poolNo?: number;
  size?: "sm" | "lg";
  showLabels?: boolean;
}

export function MarketBar({
  yesPercent,
  poolYes,
  poolNo,
  size = "sm",
  showLabels = true,
}: MarketBarProps) {
  const t = useTranslations("prediction");
  const noPercent = 100 - yesPercent;
  const barHeight = size === "lg" ? "h-4" : "h-2";
  const ariaLabel = `${t("yes")} ${yesPercent}%, ${t("no")} ${noPercent}%`;

  return (
    <div className="space-y-1">
      <div
        role="meter"
        aria-valuenow={yesPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel}
        className={`flex ${barHeight} w-full overflow-hidden rounded-full`}
      >
        <div
          className="bg-bullish transition-all duration-300"
          style={{ width: `${Math.max(yesPercent, 5)}%` }}
        />
        <div
          className="bg-bearish transition-all duration-300"
          style={{ width: `${Math.max(noPercent, 5)}%` }}
        />
      </div>
      {showLabels && (
        <div className={`flex justify-between ${size === "lg" ? "text-sm" : "text-xs"}`}>
          <span className="text-bullish font-medium">
            {t("yes")} {yesPercent}%
            {size === "lg" && poolYes !== undefined && (
              <span className="text-muted-foreground font-normal">
                {" "}
                &mdash; ${poolYes.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>
            )}
          </span>
          <span className="text-bearish font-medium">
            {t("no")} {noPercent}%
            {size === "lg" && poolNo !== undefined && (
              <span className="text-muted-foreground font-normal">
                {" "}
                &mdash; ${poolNo.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
