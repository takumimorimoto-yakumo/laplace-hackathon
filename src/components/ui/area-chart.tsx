"use client";

import { useRef, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { mapPriceToCoordinates, coordinatesToPolyline, coordinatesToAreaPath } from "@/lib/chart-utils";
import { cn } from "@/lib/utils";

interface AreaChartProps {
  /** Data values to plot */
  values: number[];
  /** Chart title */
  title: string;
  /** Formatted value label shown top-right */
  valueLabel: string;
  /** Label color class (e.g. "text-primary", "text-bullish") */
  valueLabelClass?: string;
  /** Stroke color (CSS color) */
  strokeColor?: string;
  /** Fill color (CSS color with alpha) */
  fillColor?: string;
  /** Chart height in px */
  height?: number;
  className?: string;
  /** Optional content rendered to the right of the value label in the header */
  headerRight?: ReactNode;
}

export function AreaChart({
  values,
  title,
  valueLabel,
  valueLabelClass = "text-primary",
  strokeColor = "#7c3aed",
  fillColor = "rgba(124,58,237,0.1)",
  height = 140,
  className,
  headerRight,
}: AreaChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  const padX = 8;
  const padY = 12;

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

  return (
    <div className={cn("rounded-lg border border-border p-4", className)}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-mono font-medium", valueLabelClass)}>
            {valueLabel}
          </span>
          {headerRight}
        </div>
      </div>

      <div ref={containerRef} className="w-full">
        <svg width={width} height={height} className="overflow-visible">
          <path d={areaPath} fill={fillColor} />
          <polyline
            points={polyline}
            fill="none"
            stroke={strokeColor}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
