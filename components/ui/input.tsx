import * as React from "react";
import { cn } from "@/lib/utils";
export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn("focus-ring h-12 w-full rounded-xl border border-primary/15 bg-white px-4 text-sm text-[#111111] shadow-sm placeholder:text-[#81796c] focus:border-primary", className)} {...props} />
));
Input.displayName = "Input";
