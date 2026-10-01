import { cn } from "~/lib/cn";
import { DIAL_CODE } from "~/shared/domain";

// 16 px sur mobile : en dessous, iOS zoome sur le champ à chaque saisie.
const control = "block w-full rounded-xl border border-line bg-white px-4 text-base sm:text-[15px] text-ink placeholder:text-muted/70 hover:border-brand-200 focus:border-brand-600 focus:outline-none disabled:bg-canvas";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, "min-h-12", className)} {...props} />;
}

// Téléphone : l'indicatif de Bissau est affiché devant, inutile de le taper. Un numéro étranger commence par « + » ou « 00 ».
export function PhoneInput({ className, value, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value"> & { value: string }) {
  const local = !/^\s*(\+|00)/.test(value);
  return <div className="relative">
    {local && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-base font-semibold text-muted sm:text-[15px]">+{DIAL_CODE}</span>}
    <input type="tel" inputMode="tel" value={value} className={cn(control, "min-h-12", local && "pl-[4.25rem]", className)} {...props} />
  </div>;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, "min-h-12 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%235b665f%22><path d=%22M5.5 7.5 10 12l4.5-4.5%22 stroke=%22%235b665f%22 stroke-width=%221.6%22 fill=%22none%22 stroke-linecap=%22round%22/></svg>')] bg-[length:1.1rem] bg-[right_0.9rem_center] bg-no-repeat pr-10", className)} {...props}>{children}</select>;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-24 py-3", className)} {...props} />;
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-semibold text-ink", className)} {...props} />;
}

export function Field({ id, label, hint, children, className }: { id?: string; label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return <div className={className}>
    <Label htmlFor={id}>{label}</Label>
    {children}
    {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
  </div>;
}

// Choix multiples ou uniques sous forme de puces (grandes zones tactiles).
export function Chips<T extends string>({ label, options, selected, onToggle, className }: {
  label?: string;
  options: readonly { id: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
  className?: string;
}) {
  const chips = <div className="flex flex-wrap gap-2">
    {options.map((option) => {
      const active = selected.includes(option.id);
      return <button key={option.id} type="button" aria-pressed={active} onClick={() => onToggle(option.id)}
        className={cn("min-h-10 rounded-full border px-4 text-sm font-medium", active ? "border-brand-800 bg-brand-800 text-white" : "border-line bg-white text-ink hover:border-brand-200")}>
        {option.label}
      </button>;
    })}
  </div>;
  return label ? <fieldset className={className}><legend className="mb-2 text-sm font-semibold text-ink">{label}</legend>{chips}</fieldset> : <div className={className}>{chips}</div>;
}

export function FormMessage({ tone = "error", children }: { tone?: "error" | "success"; children: React.ReactNode }) {
  return <p role={tone === "error" ? "alert" : "status"} className={cn("rounded-xl px-4 py-3 text-sm", tone === "error" ? "bg-flag-50 text-[#a3201b]" : "bg-brand-50 text-brand-800")}>{children}</p>;
}
