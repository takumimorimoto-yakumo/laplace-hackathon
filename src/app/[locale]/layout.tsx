import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { WalletProvider } from "@/components/wallet/wallet-provider";
import { ShareSheetProvider } from "@/components/post/share-sheet-provider";
import { Toaster } from "@/components/ui/sonner";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = (await import(`@/messages/${locale}.json`)).default;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <WalletProvider>
        <ShareSheetProvider>
          {children}
        </ShareSheetProvider>
        <Toaster />
      </WalletProvider>
    </NextIntlClientProvider>
  );
}
