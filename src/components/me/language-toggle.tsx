"use client";

import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type LocaleOption = "en" | "ja" | "zh";

const LOCALES: LocaleOption[] = ["en", "ja", "zh"];

interface LanguageToggleProps {
  className?: string;
}

export function LanguageToggle({ className }: LanguageToggleProps) {
  const router = useRouter();
  const pathname = usePathname();

  const segments = pathname.split("/");
  const currentLocale = LOCALES.includes(segments[1] as LocaleOption)
    ? (segments[1] as LocaleOption)
    : "en";

  function cycleLocale() {
    const currentIndex = LOCALES.indexOf(currentLocale);
    const nextIndex = (currentIndex + 1) % LOCALES.length;
    const nextLocale = LOCALES[nextIndex];
    const newSegments = [...segments];
    if (newSegments.length >= 2) {
      newSegments[1] = nextLocale;
    }
    router.replace(newSegments.join("/"));
  }

  return (
    <button
      type="button"
      onClick={cycleLocale}
      className={cn(
        "rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-primary/50",
        className
      )}
    >
      {currentLocale.toUpperCase()}
    </button>
  );
}
