import type { Truck } from "@/types/truck";

const images = {
  road: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1400&q=82",
  freight: "https://images.unsplash.com/photo-1586191582151-f73872dfd183?auto=format&fit=crop&w=1400&q=82",
  fleet: "https://images.unsplash.com/photo-1559297434-fae8a1916a79?auto=format&fit=crop&w=1400&q=82",
  port: "https://images.unsplash.com/photo-1494412519320-aa613dfb7738?auto=format&fit=crop&w=1400&q=82",
  highway: "https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=1400&q=82",
  cargo: "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=1400&q=82",
};

export const trucks: Truck[] = [
  {
    id: "trk-001", slug: "scania-r450-plateau", name: "Scania R450 Plateau", brand: "Scania", model: "R450", type: "flatbed", capacityTons: 32,
    location: "Bissau", serviceAreas: ["Bissau", "Bafatá", "Gabú", "Ziguinchor"], acceptedMaterials: ["Castanha de caju", "Materiais de construção", "Mercadorias diversas"], availability: "available",
    ownerName: "Mamadú Baldé", companyName: "TransGuiné Logística", ownerType: "company", phone: "+245 955 123 456", whatsapp: "+245955123456",
    description: "Plataforma de longa distância, preparada para produtos agrícolas, paletes e materiais de construção.", images: [images.road, images.freight, images.fleet], verified: true,
    restrictions: ["Carga devidamente acondicionada", "Peso a confirmar antes da partida"],
  },
  {
    id: "trk-002", slug: "mercedes-actros-benne", name: "Mercedes Actros Benne", brand: "Mercedes-Benz", model: "Actros 3340", type: "dump_truck", capacityTons: 25,
    location: "Bafatá", serviceAreas: ["Bafatá", "Gabú", "Mansôa"], acceptedMaterials: ["Areia", "Cascalho", "Pedras"], availability: "in_transit", availableFrom: "30 de julho",
    ownerName: "Ibrahima Djaló", ownerType: "individual", phone: "+245 966 408 210", whatsapp: "+245966408210",
    description: "Basculante robusta para obras, pedreiras e fornecimento de materiais a granel.", images: [images.fleet, images.highway], verified: true,
    restrictions: ["Sem resíduos perigosos", "Acesso ao estaleiro obrigatório"],
  },
  {
    id: "trk-003", slug: "man-tgx-porte-conteneur", name: "MAN TGX Porte-conteneur", brand: "MAN", model: "TGX 18.440", type: "container", capacityTons: 30,
    location: "Bissau", serviceAreas: ["Porto de Bissau", "Quinhamel", "Mansôa", "Ziguinchor"], acceptedMaterials: ["Contentores", "Mercadorias diversas", "Equipamentos industriais"], availability: "available",
    ownerName: "Fatumata Indjai", companyName: "Nô Karga SARL", ownerType: "company", phone: "+245 955 880 412", whatsapp: "+245955880412",
    description: "Porta-contentor disponível para levantamentos no porto e distribuição regional.", images: [images.port, images.road], verified: true,
    restrictions: ["Documentos portuários obrigatórios", "Contentores de 20 ou 40 pés"],
  },
  {
    id: "trk-004", slug: "volvo-fh-semi-remorque", name: "Volvo FH Semi-remorque", brand: "Volvo", model: "FH 460", type: "trailer", capacityTons: 35,
    location: "Gabú", serviceAreas: ["Gabú", "Bafatá", "Bissau", "Dakar"], acceptedMaterials: ["Castanha de caju", "Produtos agrícolas", "Matérias-primas"], availability: "in_transit", availableFrom: "1 de agosto",
    ownerName: "João Có", companyName: "Kaminhu Forte", ownerType: "company", phone: "+245 966 771 300", whatsapp: "+245966771300",
    description: "Conjunto de grande capacidade para fluxos agrícolas regionais e ligações interurbanas.", images: [images.highway, images.freight], verified: true,
    restrictions: ["Apenas mercadoria seca", "Cobertura obrigatória na época das chuvas"],
  },
  {
    id: "trk-005", slug: "mitsubishi-canter-cargo", name: "Mitsubishi Canter", brand: "Mitsubishi", model: "Fuso Canter", type: "canter", capacityTons: 7,
    location: "Canchungo", serviceAreas: ["Canchungo", "Cacheu", "Bissorã"], acceptedMaterials: ["Produtos agrícolas", "Sacos", "Mercadorias diversas"], availability: "available",
    ownerName: "Abulai Sanhá", ownerType: "individual", phone: "+245 955 342 888", whatsapp: "+245955342888",
    description: "Camião compacto para recolhas, mercados e entregas em estradas secundárias.", images: [images.cargo, images.road], verified: false,
    restrictions: ["Volume máximo a confirmar", "Sem carga abrasiva a granel"],
  },
  {
    id: "trk-006", slug: "iveco-trakker-benne", name: "Iveco Trakker Benne", brand: "Iveco", model: "Trakker 380", type: "dump_truck", capacityTons: 28,
    location: "Bissorã", serviceAreas: ["Bissorã", "Mansôa", "Bissau"], acceptedMaterials: ["Areia", "Cascalho", "Pedras", "Terra"], availability: "in_transit",
    ownerName: "Carlos Gomes", companyName: "Obra Norte", ownerType: "company", phone: "+245 966 119 540", whatsapp: "+245966119540",
    description: "Basculante reforçada para obras públicas e abastecimento de estaleiros.", images: [images.fleet, images.highway], verified: true,
    restrictions: ["Distância avaliada conforme a estrada", "Carregamento mecânico pelo cliente"],
  },
  {
    id: "trk-007", slug: "renault-premium-fourgon", name: "Renault Premium Fourgon", brand: "Renault Trucks", model: "Premium 280", type: "cargo", capacityTons: 12,
    location: "Cacheu", serviceAreas: ["Cacheu", "Canchungo", "Quinhamel"], acceptedMaterials: ["Castanha de caju", "Produtos agrícolas", "Paletes"], availability: "maintenance", availableFrom: "29 de julho",
    ownerName: "Adama Mané", ownerType: "individual", phone: "+245 955 602 744", whatsapp: "+245955602744",
    description: "Carga fechada para proteger mercadorias da chuva e da poeira.", images: [images.freight, images.cargo], verified: true,
    restrictions: ["Sem matérias líquidas", "Carga paletizada recomendada"],
  },
  {
    id: "trk-008", slug: "daf-xf-plateau", name: "DAF XF Plateau", brand: "DAF", model: "XF 105", type: "flatbed", capacityTons: 30,
    location: "Quinhamel", serviceAreas: ["Quinhamel", "Bissau", "Mansôa"], acceptedMaterials: ["Materiais de construção", "Madeira", "Tijolos"], availability: "maintenance",
    ownerName: "Binta Cassamá", companyName: "Bolama Transit", ownerType: "company", phone: "+245 966 930 011", whatsapp: "+245966930011",
    description: "Plataforma versátil para materiais compridos, madeira e mercadorias volumosas.", images: [images.road, images.port], verified: true,
    restrictions: ["Dimensões especiais sob consulta", "Grua não incluída"],
  },
];

export const locations = ["Bissau", "Bafatá", "Gabú", "Cacheu", "Bissorã", "Canchungo", "Mansôa", "Quinhamel", "Ziguinchor", "Dakar"];
export const materials = ["Castanha de caju", "Produtos agrícolas", "Areia", "Pedras", "Cascalho", "Cimento", "Madeira", "Tijolos", "Materiais de construção", "Mercadorias diversas", "Equipamentos industriais", "Paletes", "Sacos", "Contentores"];

export function getTruckBySlug(slug: string) {
  return trucks.find((truck) => truck.slug === slug);
}
