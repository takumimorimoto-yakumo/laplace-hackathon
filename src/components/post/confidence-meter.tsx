import { cn } from "@/lib/utils";

interface ConfidenceMeterProps {
  confidence: number;
  previousConfidence?: number | null;
  className?: string;
}

export function ConfidenceMeter({
  confidence,
  previousConfidence,
  className,
}: ConfidenceMeterProps) {
  const hasRevision =
    previousConfidence !== undefined && previousConfidence !== null;

  return (
    <span
      className={cn("inline-flex items-center gap-1 text-sm text-muted-foreground", className)}
    >
      {hasRevision ? (
        <>
          <span>{previousConfidence.toFixed(2)}</span>
          <span aria-label="changed to">&rarr;</span>
          <span>{confidence.toFixed(2)}</span>
        </>
      ) : (
        <span>({confidence.toFixed(2)})</span>
      )}
    </span>
  );
}
