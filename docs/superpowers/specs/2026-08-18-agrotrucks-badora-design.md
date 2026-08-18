# AgroTrucks by Badora — pivot logistique

Date : 2026-08-18
Statut : proposé, en attente de relecture

## Contexte

AgroTruck est aujourd'hui un annuaire public en lecture seule (Next.js, export
statique sur Netlify) : les camions viennent d'une API externe
(`AGROTRUCK_DIRECTORY_API_URL`), le contact se fait par téléphone/WhatsApp, et
les avis visiteurs sont stockés dans Netlify Blobs via une fonction Netlify
(`netlify/functions/reviews.mts`). Ce modèle n'était pas rentable.

Le nouveau projet : vendre l'application à **Badora**, loueur de camions le
plus connu du marché, qui a besoin d'un outil pour piloter sa flotte et son
réseau de partenaires — pas seulement d'un annuaire public.

Le fonctionnement métier de Badora : Badora loue ses propres camions. Quand
il n'a plus de camion disponible, il fait appel à des transporteurs
partenaires qui n'ont pas de client au même moment. Aujourd'hui cette mise en
relation est manuelle (mémoire, appels). L'application doit la remplacer par
un tableau de bord temps réel et un flux de demandes clients déjà qualifié.

## Vision produit

Trois profils d'utilisateurs :

- **Badora (admin)** — pilote la flotte unifiée (ses camions + ceux des
  partenaires), valide les annonces partenaires avant publication, reçoit les
  demandes clients.
- **Partenaires transporteurs** — invités par Badora (pas d'auto-inscription),
  publient leurs camions (soumis à validation), tiennent à jour la
  disponibilité de leurs propres véhicules.
- **Clients** — grand public, sans compte, parcourent l'offre et soumettent
  une demande de location (nombre de camions, type, trajet, date,
  marchandise) qui part vers WhatsApp.

Aucun prix n'est affiché nulle part (déjà le cas dans le schéma `Truck`
actuel — rien à retirer). La marque visible côté client est uniquement
**AgroTrucks by Badora** : les annonces ne distinguent pas publiquement un
camion Badora d'un camion partenaire, Badora reste le seul interlocuteur
visible. Conséquence directe : les pages publiques par entreprise
(`app/entreprises/`, `app/entreprises/[slug]/`) sont supprimées — plus de
mise en avant individuelle d'un transporteur partenaire.

## Modèle de données

### Truck (étend le schéma existant dans `lib/truck-directory.ts`)

Champs conservés : `id, slug, name, brand, model, type, capacityTons,
location, serviceAreas, acceptedMaterials, availability, description,
images, restrictions`. Toujours pas de champ prix.

Champs modifiés/ajoutés :

- `ownerAccountId` — lie le camion à un compte (`Account`, voir plus bas).
  Remplace la dépendance à l'API externe : chaque camion est désormais créé
  via l'interface de publication, par un compte Badora ou un compte
  partenaire.
- `listingStatus: "pending" | "published" | "rejected"` — remplace le
  booléen `verified`. Un camion `pending` n'apparaît jamais publiquement.
- `availability: "available" | "in_transit" | "maintenance"` — inchangé dans
  sa forme, mais devient la donnée centrale du tableau de bord Badora plutôt
  qu'un détail de fiche. Modifiable par le propriétaire du compte sans
  repasser par une validation (c'est une donnée qui doit rester fraîche en
  permanence).

Les champs `ownerName`, `companyName`, `ownerType` restent en base (utile en
interne pour Badora, ex. dans le tableau de bord) mais ne sont plus rendus
sur les pages publiques.

### Account

```
{ id, phone, passwordHash, role: "admin" | "partner",
  displayName, createdAt }
```

Seul un compte `admin` (Badora) peut créer un compte `partner`. Pas
d'inscription libre.

### Order (nouvelle entité — la demande client)

```
{ id, requestedTruckCount, truckType, pickupLocation, dropoffLocation,
  neededFrom, cargoDescription, clientName, clientPhone, createdAt }
```

Une demande n'est pas liée à un camion précis : le client exprime un besoin
("3 bennes entre Bissau et Bafatá le 20"), pas une réservation d'un véhicule
identifié.

## Authentification

Netlify Identity est en fin de vie côté Netlify — écarté. Auth maison légère,
cohérente avec le pattern déjà en place (`netlify/functions/reviews.mts`
utilise déjà Netlify Functions + Blobs) :

- Téléphone + mot de passe, hash stocké dans un Blob `accounts`.
- Session via cookie signé (JWT), émis/vérifié par une Netlify Function.
- Deux rôles : `admin` (Badora), `partner`.
- Aucune inscription publique ; seul un admin crée des comptes partenaires
  (formulaire dans le dashboard admin).

## Flux partenaire — publication

1. Le partenaire se connecte (`/partner/login`).
2. Il crée/édite ses camions via un formulaire (mêmes champs que `Truck`,
   sans prix). Une création ou une modification d'un champ sensible
   (capacité, type, description) repasse le camion en `pending`.
3. Le changement de `availability` seul ne redéclenche **pas** de validation
   — cette donnée doit pouvoir être mise à jour librement et à tout moment.
4. Badora voit les camions `pending` dans son dashboard et les
   publie/rejette.

## Flux client — demande de location

1. Page publique (fait évoluer `app/location/page.tsx`) : formulaire avec
   nombre de camions souhaités, type de camion, lieu de départ/arrivée, date,
   description de la marchandise, nom et téléphone du client.
2. À la soumission :
   - Un `Order` est enregistré dans Blobs (historique, visible dans le
     dashboard Badora).
   - Un lien `wa.me` pré-rempli est généré (même pattern que
     `lib/contact.ts` → `whatsappUrl`) vers le numéro Badora, avec le
     résumé de la demande. Le client clique sur « Envoyer » dans WhatsApp —
     pas d'envoi automatisé côté serveur, pas d'API WhatsApp Business (coût
     et vérification d'entreprise évités pour cette version).

## Tableau de bord logistique Badora

Route protégée (`/admin`, accès réservé au rôle `admin`) :

- **Vue flotte unifiée** : tous les camions (Badora + partenaires), triés/
  filtrables par `availability`. Répond directement à la question « dois-je
  contacter un partenaire maintenant ? ».
- **File de validation** : annonces partenaires `pending` à approuver/
  rejeter.
- **Historique des demandes clients** : liste des `Order` reçus.
- **Gestion des comptes partenaires** : création d'un compte partenaire
  (téléphone + mot de passe généré).

## Stockage

Netlify Blobs (déjà utilisé pour les avis), pas de base de données
relationnelle pour cette version — les dossiers `db/` et `drizzle/` du repo
sont vides et ne sont pas réactivés ici. Stores prévus :

- `agrotruck-accounts` — comptes admin/partenaire
- `agrotruck-trucks` — remplace la source API externe
- `agrotruck-orders` — demandes clients
- `agrotruck-reviews` — inchangé (déjà en place)

## Migration de l'existant

- `AGROTRUCK_DIRECTORY_API_URL` / `AGROTRUCK_DIRECTORY_API_TOKEN` /
  `AGROTRUCK_DIRECTORY_REVALIDATE_SECONDS` sont retirés : la flotte Badora
  n'est plus alimentée par une API externe, elle passe par la même interface
  de publication que les partenaires (un compte `admin` Badora publie ses
  propres camions comme un partenaire publierait les siens).
- `data/trucks.ts` reste comme données de démo pour le développement local
  uniquement.
- Suppression de `app/entreprises/` et `app/entreprises/[slug]/` (offre
  unifiée sous la marque Badora, plus de fiche entreprise publique).
- Rebranding : logo/titre → « AgroTrucks by Badora » (`app/layout.tsx`,
  `app/manifest.ts`, assets dans `public/brand/`).

## Stratégie pour convaincre Badora

Livrable séparé du code : un argumentaire structuré autour de trois axes —

1. **Coût actuel de la coordination manuelle** : temps perdu à chercher un
   partenaire disponible, risque de perdre un client faute de réponse rapide.
2. **Image de marque** : Badora structure et fédère tout un écosystème de
   partenaires sous son propre nom, renforçant sa position de leader plutôt
   que de laisser les partenaires exister de façon indépendante/concurrente.
3. **Preuve par la démo**, pas par la théorie : montrer le tableau de bord en
   fonctionnement (flotte + demandes entrantes) plutôt qu'un pitch abstrait.

## Hors scope pour cette version

- Envoi automatisé côté serveur via l'API WhatsApp Business.
- Réservation d'un camion précis par le client (l'`Order` reste une demande
  générique, Badora fait le matching).
- Base de données relationnelle / rapports statistiques avancés.
- Affichage public de l'identité du partenaire propriétaire d'un camion.

## Plan de test

- Flux partenaire : création de camion → `pending` → invisible publiquement
  → validation admin → visible publiquement.
- Changement de `availability` par un partenaire ne redéclenche pas de
  validation.
- Flux client : soumission du formulaire → `Order` enregistré → lien
  `wa.me` correctement formé avec les données saisies.
- Accès : un compte `partner` ne peut pas accéder à `/admin` ; un visiteur
  non connecté ne peut ni publier ni voir la file de validation.
- Aucune page ni réponse d'API n'expose de prix ni le nom d'un partenaire
  propriétaire.
