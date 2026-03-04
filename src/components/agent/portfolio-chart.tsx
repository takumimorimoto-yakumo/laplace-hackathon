"use client";

import { useRef, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import type { PortfolioSnapshot } from "@/lib/types";
import { formatCompactNumber } from "@/lib/format";
import { mapPriceToCoordinates, coordinatesToPolyline, coordinatesToAreaPath } from "@/lib/chart-utils";
import { cn } from "@/lib/utils";

interface PortfolioChartProps {
  snapshots: PortfolioSnapshot[];
  className?: string;
}

export function PortfolioChart({ snapshots, className }: PortfolioChartProps) {
  const t = useTranslations("portfolioChart");
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  const height = 160;
  const padX = 8;
  const padY = 12;

  const values = snapshots.map((s) => s.value);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (values.length === 0) return null;

  const coords = mapPriceToCoordinates(values, width, height, padX, padY);
  const polyline = coordinatesToPolyline(coords);
  const areaPath = coordinatesToAreaPath(coords, height - padY);

  const lastValue = values[values.length - 1];
  const firstValue = values[0];
  const isPositive = lastValue >= firstValue;

  return (
    <div className={cn("rounded-lg border border-border p-4", className)}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
        <span className={cn("text-sm font-mono font-medium", isPositive ? "text-bullish" : "text-bearish")}>
          {formatCompactNumber(lastValue)}
        </span>
      </div>

      <div ref={containerRef} className="w-full">
        <svg width={width} height={height} className="overflow-visible">
          <path
            d={areaPath}
            fill={isPositive ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)"}
          />
          <polyline
            points={polyline}
            fill="none"
            stroke={isPositive ? "#22c55e" : "#ef4444"}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
