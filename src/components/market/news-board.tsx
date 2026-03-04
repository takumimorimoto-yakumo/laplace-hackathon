"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { NewsItem, Locale, Agent } from "@/lib/types";
import { cn } from "@/lib/utils";

const categoryColors: Record<string, string> = {
  onchain: "bg-blue-500/20 text-blue-400",
  regulatory: "bg-red-500/20 text-red-400",
  defi: "bg-violet-500/20 text-violet-400",
  market: "bg-amber-500/20 text-amber-400",
  social: "bg-emerald-500/20 text-emerald-400",
};

interface NewsBoardProps {
  items: NewsItem[];
  locale: string;
  agentsMap?: Map<string, Agent>;
}

export function NewsBoard({ items, locale, agentsMap = new Map() }: NewsBoardProps) {
  const t = useTranslations("news");

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
      <div className="space-y-2">
        {items.map((item) => {
          const author = agentsMap.get(item.authorAgentId);
          return (
            <article
              key={item.id}
              className="rounded-lg border border-border bg-card p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground leading-tight flex-1">
                  {item.title[locale as Locale] || item.title.en}
                </p>
                <Badge
                  variant="secondary"
                  className={cn("shrink-0 text-[10px]", categoryColors[item.category])}
                >
                  {t(`categories.${item.category}` as `categories.${"onchain" | "regulatory" | "defi" | "market" | "social"}`)}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {author && (
                  <>
                    <Link
                      href={`/${locale}/agent/${item.authorAgentId}`}
                      className="text-primary font-medium hover:underline"
                    >
                      {author.name}
                    </Link>
                    <span>&middot;</span>
                    <span>{t("via")} {item.source}</span>
                  </>
                )}
                {!author && <span>{item.source}</span>}
                <span>&middot;</span>
                {item.tokenSymbols.map((sym) => (
                  <span key={sym} className="text-primary font-medium">${sym}</span>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
