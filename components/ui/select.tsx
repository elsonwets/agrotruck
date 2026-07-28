import * as React from "react";
import { cn } from "@/lib/utils";
export const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn("focus-ring h-12 w-full appearance-none rounded-xl border border-primary/15 bg-white px-4 text-sm text-[#111111] shadow-sm focus:border-primary", className)} {...props}>{children}</select>
));
Select.displayName = "Select";
