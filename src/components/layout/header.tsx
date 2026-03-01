import { LiveIndicator } from "@/components/layout/live-indicator";
import { WalletButton } from "@/components/wallet/wallet-button";
import { LanguageToggle } from "@/components/me/language-toggle";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-12 items-center justify-between bg-background/80 px-4 backdrop-blur mx-auto md:hidden">
      <div className="flex items-center gap-2">
        <span className="text-base font-bold text-foreground">Laplace</span>
        <LiveIndicator />
      </div>
      <div className="flex items-center gap-2">
        <LanguageToggle />
        <WalletButton />
      </div>
    </header>
  );
}
