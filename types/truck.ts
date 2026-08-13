export type TruckAvailability = "available" | "in_transit" | "maintenance";
export type ListingMode = "transport" | "rental" | "sale";
export type TruckType =
  | "flatbed" | "covered" | "dump_truck" | "cargo" | "refrigerated" | "tanker"
  | "container" | "crane" | "pickup" | "cargo_tricycle" | "road_tractor"
  | "flatbed_trailer" | "covered_trailer" | "agricultural_tractor" | "farm_trailer"
  | "loader" | "road_machine" | "private_taxi" | "shared_taxi" | "seven_seater"
  | "toca_toca" | "minibus" | "candonga" | "coach" | "suv" | "chauffeur_car";

export interface TruckRatings {
  overall: number;
  vehicleQuality: number;
  professionalism: number;
  reliability: number;
  reviewCount: number;
}

export interface Truck {
  id: string;
  slug: string;
  name: string;
  brand: string;
  model: string;
  type: TruckType;
  listingMode: ListingMode;
  capacityTons: number;
  location: string;
  serviceAreas: string[];
  acceptedMaterials: string[];
  availability: TruckAvailability;
  availableFrom?: string;
  ownerName: string;
  companyName?: string;
  ownerType: "individual" | "company";
  phone: string;
  whatsapp: string;
  description: string;
  images: string[];
  verified: boolean;
  restrictions: string[];
  ratings?: TruckRatings;
}

export const truckTypeLabels: Record<TruckType, string> = {
  flatbed: "Camion plateau", covered: "Camion bâché", dump_truck: "Camion benne",
  cargo: "Camion caisse / fourgon", refrigerated: "Camion frigorifique", tanker: "Camion-citerne",
  container: "Camion porte-conteneur", crane: "Camion grue", pickup: "Pick-up",
  cargo_tricycle: "Tricycle cargo", road_tractor: "Tracteur routier", flatbed_trailer: "Semi-remorque plateau",
  covered_trailer: "Semi-remorque bâchée", agricultural_tractor: "Tracteur agricole", farm_trailer: "Remorque agricole",
  loader: "Chargeuse / engin de chantier", road_machine: "Engin routier", private_taxi: "Taxi privé",
  shared_taxi: "Taxi collectif", seven_seater: "Voiture sept places", toca_toca: "Toca-toca",
  minibus: "Minibus / van", candonga: "Candonga", coach: "Bus / autocar", suv: "SUV / 4x4",
  chauffeur_car: "Location avec chauffeur",
};

export const listingModeLabels: Record<ListingMode, string> = {
  transport: "Transport de charge", rental: "Location", sale: "À vendre",
};

export const availabilityLabels: Record<TruckAvailability, string> = {
  available: "Disponível",
  in_transit: "Em trânsito",
  maintenance: "Manutenção",
};
