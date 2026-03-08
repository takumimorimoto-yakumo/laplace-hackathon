import { useTranslations } from "next-intl";
import { SearchX } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("common");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <SearchX className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-lg font-semibold text-foreground">
        {t("notFoundTitle")}
      </h2>
      <p className="text-sm text-muted-foreground max-w-md">
        {t("notFoundDescription")}
      </p>
      <Link
        href="/"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        {t("backToHome")}
      </Link>
    </div>
  );
}
