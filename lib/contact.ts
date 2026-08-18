import { whatsappUrl } from "@/lib/utils";

export const agroTruckWhatsapp = process.env.NEXT_PUBLIC_AGROTRUCK_WHATSAPP ?? "+245955000100";

export const truckRegistrationWhatsappUrl = whatsappUrl(
  agroTruckWhatsapp,
  "Olá, gostaria de me tornar parceiro da AgroTrucks by Badora.",
);
