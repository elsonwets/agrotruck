// Offres des transporteurs : un prix proposé (en FCFA) pour une mission. Le producteur en retient une seule.

export const OFFER_STATUSES = ["pending", "accepted", "declined", "withdrawn"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const MAX_PRICE = 50_000_000; // FCFA

// Prix entier, strictement positif, raisonnable.
export function isValidPrice(price: number): boolean {
  return Number.isInteger(price) && price > 0 && price <= MAX_PRICE;
}

// Ordre d'affichage pour le producteur : offres en attente d'abord, de la moins chère à la plus chère.
export function sortOffers<T extends { status: OfferStatus; price: number; updatedAt: number }>(offers: T[]): T[] {
  const rank: Record<OfferStatus, number> = { accepted: 0, pending: 1, declined: 2, withdrawn: 3 };
  return [...offers].sort((a, b) => rank[a.status] - rank[b.status] || a.price - b.price || a.updatedAt - b.updatedAt);
}
