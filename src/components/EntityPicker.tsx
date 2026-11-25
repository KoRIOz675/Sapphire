import { useState } from "react";

interface EntityPickerProps {
  options: { id: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  multiple?: boolean;
}

/** Simple multi / single picker with text filter. */
export default function EntityPicker({
  options,
  value,
  onChange,
  placeholder,
  multiple = true,
}: EntityPickerProps) {
  const [q, setQ] = useState("");

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(q.toLowerCase()),
  );

  function toggle(id: string) {
    if (multiple) {
      if (value.includes(id)) onChange(value.filter((v) => v !== id));
      else onChange([...value, id]);
    } else {
      onChange(value.includes(id) ? [] : [id]);
    }
  }

  return (
    <div className="space-y-2">
      <input
        className="input"
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="max-h-44 overflow-auto rounded-md border border-slate-200 bg-white">
        {filtered.length === 0 && (
          <div className="px-3 py-2 text-xs text-slate-500">—</div>
        )}
        {filtered.map((opt) => {
          const checked = value.includes(opt.id);
          return (
            <label
              key={opt.id}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              <input
                type={multiple ? "checkbox" : "radio"}
                checked={checked}
                onChange={() => toggle(opt.id)}
                className="accent-sapphire-600"
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
