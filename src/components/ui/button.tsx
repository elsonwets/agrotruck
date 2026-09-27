import { cn } from "~/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "harvest" | "whatsapp" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-brand-800 text-white hover:bg-brand-700",
  secondary: "border border-line bg-white text-brand-800 hover:border-brand-200 hover:bg-brand-50",
  ghost: "text-brand-800 hover:bg-brand-50",
  harvest: "bg-harvest-400 text-ink hover:bg-harvest-300",
  whatsapp: "bg-[#1f8f4e] text-white hover:bg-[#177a41]",
  danger: "bg-flag-500 text-white hover:bg-[#c8261f]",
};

const sizes: Record<Size, string> = {
  sm: "min-h-10 px-3.5 text-sm",
  md: "min-h-12 px-5 text-[15px]",
  lg: "min-h-14 px-6 text-base",
};

// Classes d'un bouton, utilisables aussi sur un <Link> ou un <a>.
export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.15em] [&_svg]:shrink-0",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({ variant, size, className, type = "button", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}
