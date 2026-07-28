import { cn } from "@/lib/utils";
export function SectionHeading({ eyebrow, title, description, align = "left", className }: { eyebrow?: string; title: string; description?: string; align?: "left" | "center"; className?: string }) {
  return <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
    {eyebrow && <p className="mb-3 text-xs font-bold uppercase tracking-[.2em] text-danger">{eyebrow}</p>}
    <h2 className="font-heading text-balance text-3xl font-extrabold leading-tight text-primary md:text-5xl">{title}</h2>
    {description && <p className="mt-4 text-base leading-7 text-[#6e685e] md:text-lg">{description}</p>}
  </div>;
}
