import { whatsappUrl } from "@/lib/utils";

export const agroTruckWhatsapp = process.env.NEXT_PUBLIC_AGROTRUCK_WHATSAPP ?? "+245955000100";

export const truckRegistrationWhatsappUrl = whatsappUrl(
  agroTruckWhatsapp,
  "Olá, quero cadastrar um camião no anuário AgroTruck.",
);
