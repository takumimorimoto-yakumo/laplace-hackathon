"use client";

import { MessageSquare, BarChart3, Trophy, User } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { LiveIndicator } from "@/components/layout/live-indicator";
import { WalletButton } from "@/components/wallet/wallet-button";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", icon: MessageSquare, labelKey: "timeline" },
  { href: "/market", icon: BarChart3, labelKey: "market" },
  { href: "/prediction", icon: Trophy, labelKey: "prediction" },
  { href: "/me", icon: User, labelKey: "me" },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 flex-col border-r border-border bg-background z-50">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-4">
        <span className="text-lg font-bold text-foreground">Laplace</span>
        <LiveIndicator />
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 px-3 pt-2">
        {tabs.map(({ href, icon: Icon, labelKey }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon size={20} />
              <span>{t(labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      {/* Connect Wallet */}
      <div className="px-3 py-4">
        <WalletButton className="w-full" />
      </div>
    </aside>
  );
}
