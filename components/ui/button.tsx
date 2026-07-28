import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition duration-200 disabled:pointer-events-none disabled:opacity-50",
  { variants: { variant: {
    default: "bg-primary text-white shadow-[0_8px_28px_rgba(11,61,46,.2)] hover:bg-[#145a45] hover:-translate-y-0.5",
    secondary: "border border-primary/15 bg-white text-primary shadow-sm hover:border-primary/30 hover:bg-[#f8f2e6] hover:-translate-y-0.5",
    outline: "border border-primary/40 text-primary hover:bg-primary/8",
    ghost: "text-primary/75 hover:bg-primary/5 hover:text-primary",
    whatsapp: "bg-[#1f9d55] text-white hover:bg-[#168548] hover:-translate-y-0.5",
    danger: "bg-danger text-white hover:bg-red-500",
  }, size: { default: "h-11", sm: "min-h-9 px-3", lg: "min-h-13 px-6 text-base", icon: "size-11 p-0" } }, defaultVariants: { variant: "default", size: "default" } }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
