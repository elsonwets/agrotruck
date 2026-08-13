import type { TruckType } from "@/types/truck";

export type VehicleTypeOption = {
  type: TruckType;
  group: "Camions" | "Tracteurs et engins" | "Transport de voyageurs";
  description: string;
  image: string;
};

const image = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=700&q=78`;

export const vehicleTypeOptions: VehicleTypeOption[] = [
  { type: "flatbed", group: "Camions", description: "Matériaux, sacs et marchandises volumineuses", image: image("photo-1601584115197-04ecc0da31d7") },
  { type: "covered", group: "Camions", description: "Marchandises protégées de la pluie et de la poussière", image: image("photo-1519003722824-194d4455a60c") },
  { type: "dump_truck", group: "Camions", description: "Sable, gravier, terre, déchets et chantier", image: image("photo-1625047509248-ec889cbff17f") },
  { type: "cargo", group: "Camions", description: "Colis, mobilier et produits commerciaux", image: image("photo-1566576912321-d58ddd7a6088") },
  { type: "refrigerated", group: "Camions", description: "Poisson, viande, boissons et produits sensibles", image: image("photo-1586191582151-f73872dfd183") },
  { type: "tanker", group: "Camions", description: "Eau, carburant et autres liquides", image: image("photo-1600518464441-9306b4e8d7af") },
  { type: "container", group: "Camions", description: "Transport depuis le port ou entre entrepôts", image: image("photo-1494412519320-aa613dfb7738") },
  { type: "crane", group: "Camions", description: "Levage et livraison de matériaux lourds", image: image("photo-1504307651254-35680f356dfd") },
  { type: "pickup", group: "Camions", description: "Petites marchandises, livraisons locales et zones rurales", image: image("photo-1533473359331-0135ef1b58bf") },
  { type: "cargo_tricycle", group: "Camions", description: "Petits colis et livraisons urbaines", image: image("photo-1597404294360-feeeda04612e") },
  { type: "road_tractor", group: "Tracteurs et engins", description: "Tire une remorque ou semi-remorque", image: image("photo-1559297434-fae8a1916a79") },
  { type: "flatbed_trailer", group: "Tracteurs et engins", description: "Charges longues ou lourdes", image: image("photo-1519003722824-194d4455a60c") },
  { type: "covered_trailer", group: "Tracteurs et engins", description: "Fret général protégé", image: image("photo-1586191582151-f73872dfd183") },
  { type: "agricultural_tractor", group: "Tracteurs et engins", description: "Labour, remorque agricole et activités rurales", image: image("photo-1530267981375-f0de937f5f13") },
  { type: "farm_trailer", group: "Tracteurs et engins", description: "Récoltes, bois et produits locaux", image: image("photo-1500076656116-558758c991c1") },
  { type: "loader", group: "Tracteurs et engins", description: "Chargeuse, bulldozer ou pelleteuse de chantier", image: image("photo-1580901368919-7738efb0f87e") },
  { type: "road_machine", group: "Tracteurs et engins", description: "Motoniveleuse et compacteur pour les routes", image: image("photo-1504307651254-35680f356dfd") },
  { type: "private_taxi", group: "Transport de voyageurs", description: "Déplacements urbains à Bissau", image: image("photo-1449965408869-eaa3f722e40d") },
  { type: "shared_taxi", group: "Transport de voyageurs", description: "Trajets partagés en ville ou entre localités", image: image("photo-1544620347-c4fd4a3d5957") },
  { type: "seven_seater", group: "Transport de voyageurs", description: "Taxi interurbain et voyage partagé", image: image("photo-1549317661-bd32c8ce0db2") },
  { type: "toca_toca", group: "Transport de voyageurs", description: "Minibus urbain", image: image("photo-1544620347-c4fd4a3d5957") },
  { type: "minibus", group: "Transport de voyageurs", description: "Navette, groupe et transport interurbain", image: image("photo-1570125909232-eb263c188f7e") },
  { type: "candonga", group: "Transport de voyageurs", description: "Transport collectif de 10 à 20 passagers", image: image("photo-1544620347-c4fd4a3d5957") },
  { type: "coach", group: "Transport de voyageurs", description: "Longues distances, écoles, entreprises et événements", image: image("photo-1570125909232-eb263c188f7e") },
  { type: "suv", group: "Transport de voyageurs", description: "Voyages privés et routes difficiles", image: image("photo-1533473359331-0135ef1b58bf") },
  { type: "chauffeur_car", group: "Transport de voyageurs", description: "Aéroport, tourisme, missions et déplacements professionnels", image: image("photo-1549317661-bd32c8ce0db2") },
];
