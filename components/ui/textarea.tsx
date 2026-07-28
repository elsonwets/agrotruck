import * as React from "react";
import { cn } from "@/lib/utils";
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn("focus-ring min-h-28 w-full resize-y rounded-xl border border-primary/15 bg-white p-4 text-sm text-[#111111] shadow-sm placeholder:text-[#81796c] focus:border-primary", className)} {...props} />
));
Textarea.displayName = "Textarea";
