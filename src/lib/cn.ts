import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatPhone, normalizePhone } from "~/shared/domain";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function whatsappUrl(phone: string, message: string) {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}

export function mapUrl({ lat, lng }: { lat: number; lng: number }) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function telUrl(phone: string) {
  return `tel:${formatPhone(phone)}`;
}
