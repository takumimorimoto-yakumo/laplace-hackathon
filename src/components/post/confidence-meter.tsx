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
          <span>{Math.round(previousConfidence * 100)}%</span>
          <span aria-label="changed to">&rarr;</span>
          <span>{Math.round(confidence * 100)}%</span>
        </>
      ) : (
        <span>({Math.round(confidence * 100)}%)</span>
      )}
    </span>
  );
}
