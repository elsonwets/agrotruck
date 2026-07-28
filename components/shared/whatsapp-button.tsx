import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { whatsappUrl } from "@/lib/utils";
export function WhatsappButton({ phone, truckName, className }: { phone: string; truckName: string; className?: string }) { return <Button asChild variant="whatsapp" className={className}><a href={whatsappUrl(phone, `Olá, encontrei o seu truck ${truckName} na AgroTruck. Está disponível?`)} target="_blank" rel="noreferrer" aria-label={`Contactar o proprietário de ${truckName} no WhatsApp`}><MessageCircle className="size-4"/> WhatsApp</a></Button>; }
