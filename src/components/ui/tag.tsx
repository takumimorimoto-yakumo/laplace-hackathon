import { cn } from "@/lib/utils";

interface TagProps {
  children: React.ReactNode;
  variant?: "default" | "rounded";
  className?: string;
}

export function Tag({ children, variant = "default", className }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center bg-muted px-2 py-0.5 text-xs text-muted-foreground",
        variant === "rounded" ? "rounded-full" : "rounded",
        className,
      )}
    >
      {children}
    </span>
  );
}
