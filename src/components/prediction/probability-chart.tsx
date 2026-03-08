"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

interface DataPoint {
  time: number; // timestamp ms
  yesPercent: number;
}

interface ProbabilityChartProps {
  bets: { side: "yes" | "no"; amount: number; createdAt: string }[];
  marketCreatedAt: string;
  poolYes: number;
  poolNo: number;
}

const CHART_W = 320;
const CHART_H = 140;
const PAD = { top: 16, right: 12, bottom: 24, left: 32 };
const INNER_W = CHART_W - PAD.left - PAD.right;
const INNER_H = CHART_H - PAD.top - PAD.bottom;

export function ProbabilityChart({
  bets,
  marketCreatedAt,
  poolYes,
  poolNo,
}: ProbabilityChartProps) {
  const t = useTranslations("prediction");

  const { points, currentPercent } = useMemo(() => {
    const sorted = [...bets].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const startTime = new Date(marketCreatedAt).getTime();

    // Build cumulative YES% at each bet
    let cumYes = 0;
    let cumNo = 0;
    const pts: DataPoint[] = [{ time: startTime, yesPercent: 50 }];

    for (const bet of sorted) {
      if (bet.side === "yes") cumYes += bet.amount;
      else cumNo += bet.amount;
      const total = cumYes + cumNo;
      const pct = total > 0 ? Math.round((cumYes / total) * 100) : 50;
      pts.push({ time: new Date(bet.createdAt).getTime(), yesPercent: pct });
    }

    // Current percent from pool totals
    const total = poolYes + poolNo;
    const nowPct = total > 0 ? Math.round((poolYes / total) * 100) : 50;

    return { points: pts, currentPercent: nowPct };
  }, [bets, marketCreatedAt, poolYes, poolNo]);

  if (points.length < 2) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">
          {t("probabilityHistory")}
        </h3>
        <p className="text-xs text-muted-foreground text-center py-6">
          {t("noBets")}
        </p>
      </div>
    );
  }

  const tMin = points[0].time;
  const tMax = points[points.length - 1].time;
  const tRange = tMax - tMin || 1;

  function toX(time: number): number {
    return PAD.left + ((time - tMin) / tRange) * INNER_W;
  }
  function toY(pct: number): number {
    return PAD.top + ((100 - pct) / 100) * INNER_H;
  }

  // Build SVG path
  const pathD = points
    .map((p, i) => {
      const x = toX(p.time);
      const y = toY(p.yesPercent);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  // Gradient fill area
  const firstX = toX(points[0].time);
  const lastX = toX(points[points.length - 1].time);
  const bottomY = toY(0);
  const areaD = `${pathD} L${lastX},${bottomY} L${firstX},${bottomY} Z`;

  // Y-axis labels
  const yLabels = [0, 25, 50, 75, 100];

  // Grid lines
  const gridLines = yLabels.map((pct) => toY(pct));

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          {t("probabilityHistory")}
        </h3>
        <span className="text-xs font-medium text-bullish">
          {t("yes")} {currentPercent}%
        </span>
      </div>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full h-auto"
        role="img"
        aria-label={t("probabilityHistory")}
      >
        <defs>
          <linearGradient id="prob-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--bullish))" stopOpacity={0.3} />
            <stop offset="100%" stopColor="hsl(var(--bullish))" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {gridLines.map((y, i) => (
          <line
            key={i}
            x1={PAD.left}
            y1={y}
            x2={PAD.left + INNER_W}
            y2={y}
            stroke="hsl(var(--border))"
            strokeWidth={0.5}
            strokeDasharray={i === 2 ? "none" : "2,3"}
          />
        ))}

        {/* Y-axis labels */}
        {yLabels.map((pct) => (
          <text
            key={pct}
            x={PAD.left - 4}
            y={toY(pct) + 3}
            textAnchor="end"
            className="fill-muted-foreground"
            fontSize={8}
          >
            {pct}%
          </text>
        ))}

        {/* 50% reference line */}
        <line
          x1={PAD.left}
          y1={toY(50)}
          x2={PAD.left + INNER_W}
          y2={toY(50)}
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={0.5}
          strokeOpacity={0.5}
        />

        {/* Area fill */}
        <path d={areaD} fill="url(#prob-fill)" />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="hsl(var(--bullish))"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={toX(p.time)}
            cy={toY(p.yesPercent)}
            r={i === points.length - 1 ? 3 : 2}
            fill={
              i === points.length - 1
                ? "hsl(var(--bullish))"
                : "hsl(var(--card))"
            }
            stroke="hsl(var(--bullish))"
            strokeWidth={1.5}
          />
        ))}

        {/* Current value label */}
        {points.length > 0 && (() => {
          const last = points[points.length - 1];
          const lx = toX(last.time);
          const ly = toY(last.yesPercent);
          return (
            <text
              x={Math.min(lx, PAD.left + INNER_W - 16)}
              y={ly - 8}
              textAnchor="middle"
              className="fill-bullish"
              fontSize={9}
              fontWeight={600}
            >
              {last.yesPercent}%
            </text>
          );
        })()}
      </svg>
    </div>
  );
}
