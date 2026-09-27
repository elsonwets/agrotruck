import { cn } from "~/lib/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]", className)} {...props} />;
}

type Tone = "neutral" | "brand" | "harvest" | "success" | "danger" | "outline";

const tones: Record<Tone, string> = {
  neutral: "bg-canvas text-muted",
  brand: "bg-brand-50 text-brand-800",
  harvest: "bg-harvest-100 text-harvest-700",
  success: "bg-[#e7f6ec] text-[#16693b]",
  danger: "bg-flag-50 text-[#a3201b]",
  outline: "border border-dashed border-brand-200 text-brand-700",
};

export function Badge({ tone = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)} {...props} />;
}

export function PageTitle({ title, intro, actions }: { title: string; intro?: string; actions?: React.ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
      {intro && <p className="mt-1.5 max-w-2xl text-muted">{intro}</p>}
    </div>
    {actions}
  </div>;
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return <div className="rounded-[var(--radius-card)] border border-dashed border-brand-200 bg-white px-6 py-12 text-center">
    <p className="text-lg font-semibold text-ink">{title}</p>
    {text && <p className="mx-auto mt-2 max-w-md text-muted">{text}</p>}
    {action && <div className="mt-6">{action}</div>}
  </div>;
}

export function Tabs<T extends string>({ value, options, onChange, label }: { value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void; label: string }) {
  return <div role="group" aria-label={label} className="inline-flex rounded-xl border border-line bg-white p-1">
    {options.map(([option, text]) => (
      <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)}
        className={cn("min-h-10 rounded-lg px-4 text-sm font-semibold", value === option ? "bg-brand-800 text-white" : "text-muted hover:text-ink")}>
        {text}
      </button>
    ))}
  </div>;
}
