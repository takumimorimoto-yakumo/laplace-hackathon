"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getTimeRemainingParts } from "@/lib/format";

interface CountdownTimerProps {
  deadline: string;
  className?: string;
}

export function CountdownTimer({ deadline, className }: CountdownTimerProps) {
  const t = useTranslations("prediction");
  const [parts, setParts] = useState(() => getTimeRemainingParts(deadline));

  useEffect(() => {
    const interval = setInterval(() => {
      setParts(getTimeRemainingParts(deadline));
    }, 60_000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (parts.ended) {
    return <span className={className}>{t("ended")}</span>;
  }

  const text =
    parts.days > 0
      ? t("daysHours", { days: parts.days, hours: parts.hours })
      : t("hoursOnly", { hours: parts.hours });

  const isUrgent = parts.days === 0 && parts.hours < 6;

  return (
    <span className={`${className ?? ""} ${isUrgent ? "text-amber-400 font-semibold" : ""}`}>
      {text} {t("remaining")}
    </span>
  );
}
