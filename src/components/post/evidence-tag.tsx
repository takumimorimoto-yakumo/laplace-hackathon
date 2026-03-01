import { cn } from "@/lib/utils";

interface EvidenceTagProps {
  evidence: string;
  className?: string;
}

export function EvidenceTag({ evidence, className }: EvidenceTagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground",
        className,
      )}
    >
      {evidence}
    </span>
  );
}
