import { useState } from "react";
import { formatGroup, formatRp } from "@/lib/format";

export const SectionTitle = ({ title, hint }) => (
  <div className="mb-5">
    <h3 className="font-display text-xl font-semibold">{title}</h3>
    {hint && <p className="text-sm text-muted-foreground mt-1">{hint}</p>}
  </div>
);

export const Field = ({ label, unit, children, testid }) => (
  <div className="flex flex-col gap-1.5" data-testid={testid}>
    <label className="text-xs font-semibold tracking-[0.05em] uppercase text-muted-foreground">{label}</label>
    <div className="flex items-stretch gap-2">
      <div className="flex-1">{children}</div>
      {unit && (
        <span className="flex items-center px-3 rounded-md bg-secondary text-muted-foreground text-sm font-medium whitespace-nowrap">
          {unit}
        </span>
      )}
    </div>
  </div>
);

const inputCls =
  "w-full h-11 rounded-md border border-border bg-background px-3 text-right font-mono text-foreground outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary focus:ring-2 focus:ring-primary/25 placeholder:text-muted-foreground/60";

export const NumberInput = ({ value, onChange, placeholder, testid }) => {
  const [focused, setFocused] = useState(false);
  const display = focused ? value ?? "" : formatGroup(value);
  return (
    <input
      data-testid={testid}
      inputMode="decimal"
      className={inputCls}
      value={display}
      placeholder={placeholder || "0"}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.,-]/g, ""))}
    />
  );
};

export const TextInput = ({ value, onChange, placeholder, testid }) => (
  <input
    data-testid={testid}
    className={inputCls.replace("text-right font-mono", "text-left")}
    value={value ?? ""}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
  />
);

export const SelectInput = ({ value, onChange, options, testid }) => (
  <div className="relative">
    <select
      data-testid={testid}
      className="w-full h-11 appearance-none rounded-md border border-border bg-background pl-3 pr-9 text-left text-foreground outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary focus:ring-2 focus:ring-primary/25"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => {
        const val = typeof o === "string" ? o : o.value;
        const lab = typeof o === "string" ? o : o.label;
        return (
          <option key={val} value={val}>{lab}</option>
        );
      })}
    </select>
    <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
    </svg>
  </div>
);

export const ResultLine = ({ label, value, money = true, digits, strong, testid }) => {
  const display = typeof value === "string" ? value : (money ? formatRp(value) : formatGroup(value, digits));
  return (
    <div
      className={`flex items-center justify-between gap-3 py-2 ${strong ? "border-t border-border mt-1 pt-3" : ""}`}
      data-testid={testid}
    >
      <span className={`text-sm ${strong ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{label}</span>
      <span className={`font-mono ${strong ? "text-base font-semibold text-primary" : "text-sm"}`}>{display}</span>
    </div>
  );
};

export const OutputCard = ({ label, value }) => (
  <div className="rounded-lg border border-primary/25 bg-primary/[0.06] p-5 flex items-center justify-between" data-testid="module-output">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.05em] text-primary/80">{label}</p>
      <p className="text-sm text-muted-foreground mt-0.5">Nilai ini masuk ke Total HPP</p>
    </div>
    <p className="font-mono text-2xl font-semibold text-primary">{formatRp(value)}</p>
  </div>
);
