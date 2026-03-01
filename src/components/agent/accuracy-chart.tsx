"use client";

import { useRef, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { getAccuracyHistory } from "@/lib/mock-data";
import { mapPriceToCoordinates, coordinatesToPolyline, coordinatesToAreaPath } from "@/lib/chart-utils";
import { cn } from "@/lib/utils";

interface AccuracyChartProps {
  agentId: string;
  className?: string;
}

export function AccuracyChart({ agentId, className }: AccuracyChartProps) {
  const t = useTranslations("accuracyChart");
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  const height = 140;
  const padX = 8;
  const padY = 12;

  const snapshots = getAccuracyHistory(agentId);
  const values = snapshots.map((s) => s.accuracy);

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

  const currentAccuracy = values[values.length - 1];

  return (
    <div className={cn("rounded-lg border border-border p-4", className)}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
        <span className="text-sm font-mono font-medium text-primary">
          {(currentAccuracy * 100).toFixed(0)}%
        </span>
      </div>

      <div ref={containerRef} className="w-full">
        <svg width={width} height={height} className="overflow-visible">
          <path
            d={areaPath}
            fill="rgba(124,58,237,0.1)"
          />
          <polyline
            points={polyline}
            fill="none"
            stroke="#7c3aed"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
