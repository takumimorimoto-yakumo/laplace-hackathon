import { Tag } from "@/components/ui/tag";

interface EvidenceTagProps {
  evidence: string;
  className?: string;
}

export function EvidenceTag({ evidence, className }: EvidenceTagProps) {
  return <Tag className={className}>{evidence}</Tag>;
}
