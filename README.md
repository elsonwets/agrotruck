# AgroTruck

Annuaire public de camions en Guinée-Bissau et au Sénégal. Le site est en lecture seule : il affiche les véhicules fournis par une API externe et permet de contacter directement le propriétaire par téléphone ou WhatsApp.

## Développement

```bash
pnpm install
pnpm dev
```

L’application est disponible sur `http://localhost:3000`. Sans configuration API, les données de démonstration de `data/trucks.ts` sont utilisées.

## API externe

Ajoutez ces variables dans `.env.local` :

```env
AGROTRUCK_DIRECTORY_API_URL=https://api.votre-domaine.com/public/trucks
AGROTRUCK_DIRECTORY_API_TOKEN=
AGROTRUCK_DIRECTORY_REVALIDATE_SECONDS=300
```

Le jeton est facultatif et reste côté serveur. L’API peut répondre avec un tableau, `{ "data": [...] }` ou `{ "trucks": [...] }`.

Chaque camion suit ce contrat JSON :

```json
{
  "id": "trk-001",
  "slug": "scania-r450-plateau",
  "name": "Scania R450 Plateau",
  "brand": "Scania",
  "model": "R450",
  "type": "flatbed",
  "capacityTons": 32,
  "location": "Bissau",
  "serviceAreas": ["Bissau", "Bafatá"],
  "acceptedMaterials": ["Produits agricoles"],
  "availability": "available",
  "ownerName": "Mamadú Baldé",
  "companyName": "TransGuiné Logística",
  "ownerType": "company",
  "phone": "+245 955 123 456",
  "whatsapp": "+245955123456",
  "description": "Plateau longue distance.",
  "images": ["https://cdn.votre-domaine.com/trucks/001.jpg"],
  "verified": true,
  "restrictions": ["Poids à confirmer"],
  "ratings": {
    "overall": 4.8,
    "vehicleQuality": 4.7,
    "professionalism": 4.9,
    "reliability": 4.8,
    "reviewCount": 36
  }
}
```

Valeurs autorisées :

- `type` : `flatbed`, `dump_truck`, `cargo`, `container`, `trailer`, `canter`
- `availability` : `available`, `in_transit`, `maintenance`
- les notes sont comprises entre 0 et 5

Sans URL d’API, le site utilise les données de démonstration pour le développement local. Si une API configurée est indisponible ou renvoie un format invalide, aucun faux camion n’est publié et l’erreur est écrite dans les logs serveur.

## Vérifications

```bash
pnpm lint
pnpm build
```
