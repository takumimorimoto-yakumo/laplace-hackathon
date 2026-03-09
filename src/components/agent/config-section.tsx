"use client";

interface ConfigOption {
  value: string;
  label: string;
  description: string;
}

interface ConfigSectionProps {
  label: string;
  description: string;
  options: ConfigOption[];
  value: string;
  onChange: (value: string) => void;
  columns?: number;
}

export function ConfigSection({
  label,
  description,
  options,
  value,
  onChange,
  columns = 5,
}: ConfigSectionProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        {label}
      </label>
      <p className="text-xs text-muted-foreground mb-2">{description}</p>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-lg border px-2 py-2 text-center transition-all ${
              value === opt.value
                ? "border-primary bg-primary/10 text-primary font-medium"
                : "border-border text-muted-foreground hover:border-muted-foreground/50"
            }`}
          >
            <span className="text-xs font-medium block">{opt.label}</span>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              {opt.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
