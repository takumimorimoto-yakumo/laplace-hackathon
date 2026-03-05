"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Code } from "lucide-react";
import { DeveloperApiSheet } from "@/components/me/developer-api-sheet";

export function DeveloperApiSection() {
  const t = useTranslations("developer");
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Code className="size-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <button
          onClick={() => setOpen(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t("registerButton")}
        </button>
      </div>
      <DeveloperApiSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
