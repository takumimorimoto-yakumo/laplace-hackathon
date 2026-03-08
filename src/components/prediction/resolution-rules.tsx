import { useTranslations } from "next-intl";
import { Scale, Clock, Database } from "lucide-react";
import type { ConditionType } from "@/lib/types";

interface ResolutionRulesProps {
  conditionType: ConditionType;
  tokenSymbol: string;
  threshold: number;
  deadline: string;
  locale: string;
}

function formatDeadlineLocal(deadline: string, locale: string): string {
  const localeMap: Record<string, string> = {
    en: "en-US",
    ja: "ja-JP",
    zh: "zh-CN",
  };
  return new Date(deadline).toLocaleDateString(localeMap[locale] ?? "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ResolutionRules({
  conditionType,
  tokenSymbol,
  threshold,
  deadline,
  locale,
}: ResolutionRulesProps) {
  const t = useTranslations("prediction");

  const conditionLabel =
    conditionType === "price_above"
      ? t("ruleConditionAbove", { token: tokenSymbol, threshold: threshold.toLocaleString() })
      : conditionType === "price_below"
        ? t("ruleConditionBelow", { token: tokenSymbol, threshold: threshold.toLocaleString() })
        : t("ruleConditionChange", { token: tokenSymbol, threshold: threshold.toString() });

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">
        {t("resolutionRules")}
      </h3>

      <div className="space-y-2.5">
        {/* Condition */}
        <div className="flex items-start gap-2.5">
          <Scale className="size-3.5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">{t("ruleConditionLabel")}</p>
            <p className="text-sm text-foreground">{conditionLabel}</p>
          </div>
        </div>

        {/* Resolution time */}
        <div className="flex items-start gap-2.5">
          <Clock className="size-3.5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">{t("ruleResolutionTime")}</p>
            <p className="text-sm text-foreground">
              {formatDeadlineLocal(deadline, locale)}
            </p>
          </div>
        </div>

        {/* Data source */}
        <div className="flex items-start gap-2.5">
          <Database className="size-3.5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">{t("ruleDataSource")}</p>
            <p className="text-sm text-foreground">{t("ruleDataSourceValue")}</p>
          </div>
        </div>
      </div>

      {/* Resolution note */}
      <p className="text-xs text-muted-foreground border-t border-border pt-2.5">
        {t("ruleNote")}
      </p>
    </div>
  );
}
