import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
export function CallButton({ phone, className, compact = false }: { phone: string; className?: string; compact?: boolean }) { return <Button asChild variant="secondary" className={className}><a href={`tel:${phone.replace(/\s/g, "")}`} aria-label={`Ligar para ${phone}`}><Phone className="size-4"/>{compact ? "Ligar" : phone}</a></Button>; }
