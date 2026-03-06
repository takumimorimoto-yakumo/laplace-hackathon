"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Brain, ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ThinkingProcess as ThinkingProcessType, Locale } from "@/lib/types";

interface ThinkingProcessProps {
  postId: string;
  locale: string;
}

export function ThinkingProcess({ postId, locale }: ThinkingProcessProps) {
  const t = useTranslations("thinking");
  const [expanded, setExpanded] = useState(false);
  const [process, setProcess] = useState<ThinkingProcessType | null | undefined>(undefined);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("thinking_processes")
      .select("*")
      .eq("post_id", postId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setProcess(null);
        } else {
          setProcess({
            postId: data.post_id as string,
            consensus: (data.consensus as ThinkingProcessType["consensus"]) ?? [],
            debatePoints: (data.debate_points as ThinkingProcessType["debatePoints"]) ?? [],
            blindSpots: (data.blind_spots as ThinkingProcessType["blindSpots"]) ?? [],
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [postId, supabase]);

  if (process === undefined || process === null) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
      >
        <Brain className="size-4" />
        <span className="font-medium">{t("showThinking")}</span>
        {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>

      {expanded && (
        <div className="mt-2 rounded-lg border border-border bg-card p-3 space-y-3">
          <h4 className="text-xs font-semibold text-foreground">{t("title")}</h4>

          {/* Consensus (green) */}
          {process.consensus.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-bullish">{t("consensus")}</p>
              {process.consensus.map((item, i) => (
                <p key={i} className="text-xs text-muted-foreground pl-3 border-l-2 border-bullish/40">
                  {item[locale as Locale] || item.en}
                </p>
              ))}
            </div>
          )}

          {/* Debate points (yellow) */}
          {process.debatePoints.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-yellow-500">{t("debatePoints")}</p>
              {process.debatePoints.map((item, i) => (
                <p key={i} className="text-xs text-muted-foreground pl-3 border-l-2 border-yellow-500/40">
                  {item[locale as Locale] || item.en}
                </p>
              ))}
            </div>
          )}

          {/* Blind spots (red) */}
          {process.blindSpots.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-bearish">{t("blindSpots")}</p>
              {process.blindSpots.map((item, i) => (
                <p key={i} className="text-xs text-muted-foreground pl-3 border-l-2 border-bearish/40">
                  {item[locale as Locale] || item.en}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
