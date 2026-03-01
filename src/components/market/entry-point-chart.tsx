"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import {
  mapPriceToCoordinates,
  findEntryPointCoordinate,
  coordinatesToPolyline,
  coordinatesToAreaPath,
} from "@/lib/chart-utils";
import { formatPrice } from "@/lib/format";
import type { Direction, EntryPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

interface EntryPointChartProps {
  priceData: number[];
  entryPoints: EntryPoint[];
  variant: "mini" | "full";
  className?: string;
  /** Override the default height. Only used for "full" variant. */
  heightOverride?: number;
}

function directionColor(d: Direction): string {
  if (d === "bullish") return "#22c55e";
  if (d === "bearish") return "#ef4444";
  return "#a1a1aa";
}

export function EntryPointChart({
  priceData,
  entryPoints,
  variant,
  className,
  heightOverride,
}: EntryPointChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  const [containerHeight, setContainerHeight] = useState(0);

  const isMini = variant === "mini";
  const height = isMini ? 48 : (heightOverride ?? (containerHeight || 200));
  const padX = isMini ? 4 : 8;
  const padY = isMini ? 4 : 16;
  const gradientId = isMini ? "area-grad-mini" : "area-grad-full";

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        if (cr.width > 0) setWidth(cr.width);
        if (cr.height > 0 && !isMini) setContainerHeight(cr.height);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [isMini]);

  const coords = useMemo(
    () => mapPriceToCoordinates(priceData, width, height, padX, padY),
    [priceData, width, height, padX, padY]
  );

  const currentPrice = priceData.length > 0 ? priceData[priceData.length - 1] : 0;
  const firstPrice = priceData.length > 0 ? priceData[0] : 0;
  const lineColor = currentPrice >= firstPrice ? "#22c55e" : "#ef4444";

  const priceMin = priceData.length > 0 ? Math.min(...priceData) : 0;
  const priceMax = priceData.length > 0 ? Math.max(...priceData) : 0;

  const baselineY = height - padY;

  const polylinePoints = useMemo(
    () => coordinatesToPolyline(coords),
    [coords]
  );

  const areaPath = useMemo(
    () => coordinatesToAreaPath(coords, baselineY),
    [coords, baselineY]
  );

  // Stable reference time captured once on mount
  const [referenceTime] = useState(() => Date.now());

  const entryMarkers = useMemo(() => {
    return entryPoints.map((ep) => {
      const createdAtMs = new Date(ep.createdAt).getTime();
      const hoursAgo = (referenceTime - createdAtMs) / (1000 * 60 * 60);
      const coord = findEntryPointCoordinate(
        hoursAgo,
        ep.priceAtPrediction,
        priceData.length,
        priceMin,
        priceMax,
        width,
        height,
        padX,
        padY
      );
      return { ep, coord, color: directionColor(ep.direction) };
    });
  }, [entryPoints, priceData.length, priceMin, priceMax, width, height, padX, padY, referenceTime]);

  // Current price Y coordinate for full variant
  const priceRange = priceMax - priceMin || 1;
  const innerHeight = height - padY * 2;
  const currentPriceY =
    padY + innerHeight - ((currentPrice - priceMin) / priceRange) * innerHeight;

  return (
    <div ref={containerRef} className={cn("w-full", className)}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Area fill */}
        {coords.length > 0 && (
          <path d={areaPath} fill={`url(#${gradientId})`} />
        )}

        {/* Price polyline */}
        {coords.length > 0 && (
          <polyline
            points={polylinePoints}
            fill="none"
            stroke={lineColor}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Full variant extras */}
        {!isMini && (
          <>
            {/* Y-axis labels */}
            <text
              x={padX - 2}
              y={padY + 4}
              fill="#a1a1aa"
              fontSize={10}
              textAnchor="end"
            >
              {formatPrice(priceMax)}
            </text>
            <text
              x={padX - 2}
              y={height - padY + 4}
              fill="#a1a1aa"
              fontSize={10}
              textAnchor="end"
            >
              {formatPrice(priceMin)}
            </text>
            <text
              x={padX - 2}
              y={currentPriceY + 4}
              fill="#a1a1aa"
              fontSize={10}
              textAnchor="end"
            >
              {formatPrice(currentPrice)}
            </text>

            {/* Horizontal dashed line at current price */}
            <line
              x1={padX}
              y1={currentPriceY}
              x2={width - padX}
              y2={currentPriceY}
              stroke="#a1a1aa"
              strokeOpacity={0.4}
              strokeDasharray="4 3"
              strokeWidth={1}
            />
          </>
        )}

        {/* Entry point markers */}
        {entryMarkers.map(({ ep, coord, color }) => (
          <g key={ep.postId}>
            {/* Vertical dashed line to baseline */}
            <line
              x1={coord.x}
              y1={coord.y}
              x2={coord.x}
              y2={baselineY}
              stroke={color}
              strokeOpacity={0.3}
              strokeDasharray="2 2"
              strokeWidth={1}
            />
            {/* Circle marker */}
            <circle
              cx={coord.x}
              cy={coord.y}
              r={isMini ? 3.5 : 4.5}
              fill={color}
              stroke={isMini ? "none" : "#ffffff"}
              strokeWidth={isMini ? 0 : 1}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
