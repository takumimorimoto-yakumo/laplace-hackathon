"use client";

interface ModuleOption {
  value: string;
  label: string;
}

interface ModuleSelectorProps {
  label: string;
  description: string;
  options: ModuleOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  min?: number;
  max?: number;
}

export function ModuleSelector({
  label,
  description,
  options,
  selected,
  onChange,
  min = 1,
  max = 3,
}: ModuleSelectorProps) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      if (selected.length > min) {
        onChange(selected.filter((m) => m !== value));
      }
    } else {
      if (selected.length < max) {
        onChange([...selected, value]);
      }
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        {label}
      </label>
      <p className="text-xs text-muted-foreground mb-2">{description}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isSelected = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                isSelected
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-muted text-muted-foreground border border-transparent hover:border-muted-foreground/30"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
