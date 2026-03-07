"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Code } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        <Button onClick={() => setOpen(true)}>
          {t("registerButton")}
        </Button>
      </div>
      <DeveloperApiSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
