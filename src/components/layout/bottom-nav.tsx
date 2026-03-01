"use client";

import { MessageSquare, BarChart3, Trophy, User } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", icon: MessageSquare, labelKey: "timeline" },
  { href: "/market", icon: BarChart3, labelKey: "market" },
  { href: "/prediction", icon: Trophy, labelKey: "prediction" },
  { href: "/me", icon: User, labelKey: "me" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/80 backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex h-14 items-center justify-around px-4">
        {tabs.map(({ href, icon: Icon, labelKey }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 cursor-pointer",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon size={20} />
              <span className="text-[10px] leading-none">{t(labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
