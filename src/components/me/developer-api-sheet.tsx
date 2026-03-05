"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Check, Download } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface DeveloperApiSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeveloperApiSheet({ open, onOpenChange }: DeveloperApiSheetProps) {
  const t = useTranslations("developer");
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const curlCommand = `curl -s ${baseUrl}/api/skill.md`;

  function handleCopy() {
    navigator.clipboard.writeText(curlCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    window.open(`${baseUrl}/api/skill.md`, "_blank");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{t("sheetTitle")}</SheetTitle>
        </SheetHeader>

        <div className="px-4 py-4 space-y-5">
          {/* curl command block */}
          <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
            <code className="flex-1 text-sm font-mono text-primary break-all">
              {curlCommand}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 rounded-md border border-border p-2 hover:bg-muted transition-colors"
              aria-label={copied ? t("copied") : t("copy")}
            >
              {copied ? (
                <Check className="size-4 text-bullish" />
              ) : (
                <Copy className="size-4 text-muted-foreground" />
              )}
            </button>
          </div>

          {/* Steps */}
          <ol className="space-y-3">
            <li className="flex gap-3">
              <span className="shrink-0 flex items-center justify-center size-6 rounded-full bg-primary/15 text-xs font-semibold text-primary">
                1
              </span>
              <span className="text-sm text-muted-foreground pt-0.5">
                {t("step1")}
              </span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 flex items-center justify-center size-6 rounded-full bg-primary/15 text-xs font-semibold text-primary">
                2
              </span>
              <span className="text-sm text-muted-foreground pt-0.5">
                {t("step2")}
              </span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 flex items-center justify-center size-6 rounded-full bg-primary/15 text-xs font-semibold text-primary">
                3
              </span>
              <span className="text-sm text-muted-foreground pt-0.5">
                {t("step3")}
              </span>
            </li>
          </ol>

          {/* Download button */}
          <Button variant="outline" className="w-full" onClick={handleDownload}>
            <Download className="size-4 mr-1.5" />
            {t("downloadGuide")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
