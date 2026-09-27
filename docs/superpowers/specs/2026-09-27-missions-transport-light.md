# AgroTrucks by Badora — Missions de transport (cahier des charges ultra-light)

Date : 2026-09-27
Statut : validé (décisions du 2026-09-27 intégrées)
Précédent : `2026-08-18-agrotrucks-badora-design.md` (comptes, camions, modération, demandes WhatsApp)

## Objectif

Transformer la demande de location actuelle (formulaire `/location` → WhatsApp) en **mission suivie de bout en bout** :
un producteur/coopérative publie une demande, un transporteur l'accepte, charge, livre, et Badora suit tout depuis
son tableau de bord. Application mobile-first, utilisable sur Android bas de gamme, avec un mode hors-ligne.

## Principe directeur : on étend, on ne réécrit pas

Pas de Laravel, pas de MySQL. Le projet garde **exactement** sa stack et son design actuels :

| Besoin du cahier des charges | Ce qu'on utilise déjà dans le projet |
|---|---|
| Backend API REST | Netlify Functions (`netlify/functions/*.mts`) |
| Base MariaDB/MySQL | Netlify Blobs (documents JSON, via `jsonStore()` de `_lib/accounts.ts`) |
| Frontend PWA | Next.js 16, export statique (`output: "export"`), pages client `"use client"` |
| Service worker | `public/sw.js` + `app/manifest.ts` + `app/offline/page.tsx` (déjà en place) |
| Auth téléphone + PIN | `auth.mts` + `_lib/crypto.ts` (scrypt) + cookie signé `agrotruck_session` |
| Rôles côté backend | `getSessionFromRequest()` + contrôle `session.role` dans chaque fonction |
| Protection des écrans | `components/auth/session-gate.tsx` |
| Formulaires | `components/ui/{input,select,textarea,button,label}.tsx` |
| Langues PT / FR (CR plus tard) | `components/providers/app-providers.tsx` (déjà pt/fr/en) |

Règles pour garder le code et le design intacts :

- **Aucune page publique existante n'est modifiée** (`/`, `/trucks`, `/trucks/[slug]`, `/vente`, `/about`,
  `/comment-ca-marche`). Le formulaire WhatsApp de `/location` reste tel quel pour les visiteurs sans compte.
- Les nouveaux écrans reprennent les classes existantes : `page-shell`, cartes `rounded-2xl border border-primary/10 bg-white p-5`,
  titres `font-heading text-3xl font-bold`, couleurs `primary` / `warning` / `danger`. Pas de nouvelle librairie UI.
- Pas de `framer-motion` ni de librairie de graphiques dans les nouveaux écrans (Android bas de gamme) :
  les graphiques du tableau de bord sont des barres en CSS pur.
- Export statique oblige : pas de route dynamique `[id]` pour les données privées. On garde le pattern existant
  `?id=` (comme `/partner/trucks/edit?id=…`), avec `useSearchParams()` sous `<Suspense>`.

## 1. Acteurs et rôles

Le type `AccountRole` (`types/account.ts`) passe de `"admin" | "partner"` à :

| Rôle | Correspond à | Qui le crée |
|---|---|---|
| `admin` | Badora (inchangé) | `pnpm seed:account … admin` |
| `partner` | **Transporteur** (inchangé : propriétaires de camions partenaires) | Badora, depuis `/admin/users` |
| `producer` | **Producteur / coopérative** (nouveau) | Auto-inscription sur `/inscription` |

Pas de rôle `mixed` au MVP. Un producteur qui a aussi un camion demande un compte partenaire à Badora.
Ça garde la règle actuelle : **aucun transporteur n'arrive sans validation de Badora**.

### Types de véhicules « comme on les appelle ici »

Pour les missions, on n'utilise pas les 26 types détaillés du catalogue (`TruckType`), mais une courte liste
de catégories que tout le monde connaît. Nouveau fichier `data/vehicle-categories.ts` :

| Catégorie (`VehicleCategory`) | Libellé | Types du catalogue qui y correspondent |
|---|---|---|
| `camion` | Camion | `flatbed`, `covered`, `dump_truck`, `cargo`, `refrigerated`, `tanker`, `container` |
| `camionnette` | Camionnette / pick-up | `pickup` |
| `moto_tricycle` | Moto tricycle | `cargo_tricycle` |
| `tracteur` | Tracteur + remorque | `agricultural_tractor`, `farm_trailer` |
| `semi_remorque` | Semi-remorque (gros tonnage) | `road_tractor`, `flatbed_trailer`, `covered_trailer` |

L'ordre de la liste est celui de l'écran (le camion en premier). Les engins de chantier (`crane`, `loader`,
`road_machine`) et le transport de voyageurs n'ont pas de catégorie de mission. On peut ajouter une ligne plus tard sans toucher au reste.
Le catalogue public et « Mes camions » gardent les types détaillés : rien ne change côté design.

### Zones

Les zones ne sont pas du texte libre (sinon « Gabu », « Gabú » et « Gabú ville » ne se reconnaîtraient pas). On utilise
une liste fixe, `data/zones.ts` : les régions de Guinée-Bissau (Bissau SAB, Biombo, Cacheu, Oio, Bafatá, Gabú,
Quinara, Tombali, Bolama-Bijagós). Le lieu précis (village, magasin) reste en texte libre à côté.

## 2. Écrans (MVP)

Tous les écrans privés sont des pages `"use client"` enveloppées dans `<SessionGate role="…">`, comme `/partner` et `/admin` aujourd'hui.

### A. Communs

| Écran | Route | État |
|---|---|---|
| Inscription producteur (nom optionnel, téléphone, PIN 4–6 chiffres, région + localité) | `/inscription` | nouveau |
| Connexion (téléphone + PIN/mot de passe) | `/login` | existant, libellé « PIN ou mot de passe » ; redirection selon le rôle (`producer` → `/producteur`) |
| Profil (nom, téléphone, nom d'entreprise facultatif ; transporteur : catégories de véhicules, capacité, **régions de travail** (plusieurs) ; producteur : région + localité) | `/profil` | nouveau |
| Mot de passe oublié | — | plus tard : Badora réinitialise depuis `/admin/users` au MVP |

### B. Producteur / coopérative

| Écran | Route |
|---|---|
| Accueil : bouton « Nouvelle demande de transport », liste des demandes avec statut, filtre « En cours / Terminées » | `/producteur` |
| Nouvelle demande : **type de véhicule** (Camion, Camionnette, Moto tricycle… ou « Peu importe »), chargement (**région** + lieu précis, « Ma localisation » si GPS), déchargement (région + lieu), produit (Noix de cajou / Riz / Autre), sacs + poids estimé, date, commentaire → « Publier la demande » | `/producteur/demande/nouvelle` |
| Détail : résumé, statut, **transporteur ou son entreprise** (nom + numéro du transporteur, boutons « Appeler » `tel:` et WhatsApp), « Marquer comme livré », historique | `/producteur/demande?id=…` |

Le formulaire réutilise la structure de `components/location/order-request-form.tsx` (mêmes composants `Field`, `Input`, `Select`),
avec en plus la catégorie de véhicule, les régions, le produit, les sacs et les kg.

### C. Transporteur (espace partenaire existant)

`/partner` garde « Mes camions » et gagne deux onglets :

| Onglet / écran | Route |
|---|---|
| Missions disponibles, **filtrées pour lui** (type de véhicule + région, voir flux 1) : chargement → déchargement, produit + quantité, date, « Accepter ». S'il n'a pas renseigné ses régions, message « Complétez votre profil » | `/partner?tab=disponibles` |
| Mes missions (« À charger », « Chargé – en route », « Livré » ; boutons « J'ai chargé » / « J'ai livré » avec heure optionnelle) | `/partner?tab=missions` |
| Mes camions (existant, inchangé) | `/partner?tab=camions` (onglet par défaut actuel) |
| Détail d'une mission + « Accepter cette mission » | `/partner/mission?id=…` |

### D. Admin (Badora)

| Écran | Route | État |
|---|---|---|
| Tableau de bord : missions du mois, tonnes transportées, transporteurs actifs, principaux axes (ex. Gabú → Bissau), barres CSS | `/admin` | existant (flotte) + bloc indicateurs en haut |
| Utilisateurs : producteurs et transporteurs, bloquer / activer, réinitialiser le PIN | `/admin/users` | remplace `/admin/partners` (création de partenaire conservée) |
| Missions : filtres date / statut / produit / axe, export CSV, export PDF | `/admin/orders` | existant (demandes clients) → étendu |
| File de validation des camions | `/admin/queue` | inchangé |

Export CSV généré côté navigateur (Blob + lien de téléchargement), sans dépendance.
Export PDF via une vue imprimable + `window.print()` (« Enregistrer en PDF » d'Android/Chrome), sans dépendance.

## 3. Flux

1. **Le producteur crée une demande** : `/producteur/demande/nouvelle` → `POST orders` → statut `pending`,
   événement `created`.
   **Qui la voit** dans « Missions disponibles » : les partenaires actifs (non bloqués) qui remplissent **les deux** conditions :
   - **type** : la catégorie demandée fait partie de ses catégories (celles de son profil, plus celles déduites de ses camions
     publiés dans « Mes camions ») ; « Peu importe » = toutes les catégories ;
   - **zone** : la région de chargement fait partie de ses régions de travail.

   Si personne ne correspond, Badora voit la mission « sans transporteur possible » sur `/admin/orders` et peut l'assigner à la main.
2. **Le transporteur accepte** : `POST orders?id=…&action=accept` → `assigned`, `transporterAccountId` rempli,
   événement `assigned`. Le serveur revérifie le type et la zone. Le producteur voit alors **le transporteur ou son
   entreprise** (`companyName` s'il est renseigné, sinon son nom) et **le numéro du transporteur**. Le numéro de Badora n'apparaît pas.
   Écriture conditionnelle (`onlyIfMatch` / ETag de Netlify Blobs) : si deux transporteurs acceptent en même temps,
   le second reçoit « Mission déjà prise ».
3. **Exécution** : « J'ai chargé » → `loaded` (« En cours ») ; « J'ai livré » → `delivered`.
   Le producteur peut aussi marquer `delivered` (double validation optionnelle : l'événement garde qui a confirmé).
4. **Admin** : indicateurs sur `/admin`, filtres et exports sur `/admin/orders`. Badora peut aussi annuler (`cancelled`)
   ou réassigner une mission.

Le flux anonyme actuel (`/location` → WhatsApp) continue : il crée une demande sans `producerAccountId`,
que Badora traite à la main comme aujourd'hui.

## 4. Données (Netlify Blobs)

Blobs est un stockage de documents, pas une base relationnelle : l'historique est **embarqué dans la mission**,
et les statistiques sont **calculées à la volée** (pas de table `routes_stats` ; volume faible au MVP).

### `Account` (`types/account.ts`), store `agrotruck-accounts`

Champs existants : `id, phone, passwordHash, role, displayName, createdAt`. Ajouts :

```ts
role: "admin" | "partner" | "producer";
disabled?: boolean;                     // bloqué par Badora → login refusé
companyName?: string;                   // affiché au producteur à la place du nom si renseigné
vehicleCategories?: VehicleCategory[];  // transporteur (complété par ses camions publiés)
vehicleCapacityTons?: number;
workZones?: Zone[];                     // transporteur : régions où il accepte de charger
mainZone?: Zone;                        // producteur
mainLocation?: string;                  // producteur : village / ville
updatedAt?: string;
```

`passwordHash` accepte indifféremment un PIN ou un mot de passe (même scrypt) : les comptes existants ne changent pas.

### `Order` (`types/order.ts`), store `agrotruck-orders` = la « transport_request »

On étend le type existant au lieu de créer une nouvelle entité (le flux `/location` et `/admin/orders` continuent de marcher) :

```ts
// existants
id, requestedTruckCount, truckType, pickupLocation, dropoffLocation, neededFrom,
cargoDescription, clientName, clientPhone, createdAt
// ajouts (optionnels pour rester compatibles avec les demandes déjà stockées)
producerAccountId?: string;
transporterAccountId?: string;
vehicleCategory?: VehicleCategory | "any";
pickupZone?: Zone;
dropoffZone?: Zone;
productType?: "cashew" | "rice" | "other";
quantitySacks?: number;
quantityKg?: number;
status?: "pending" | "assigned" | "loaded" | "delivered" | "cancelled"; // absent = "pending"
events?: { type: "created" | "assigned" | "loaded" | "delivered" | "cancelled"; accountId?: string; at: string; comment?: string }[];
updatedAt?: string;
```

`truckType` (type détaillé) reste pour les demandes anonymes de `/location` ; les missions utilisent `vehicleCategory`.

`in_transit` du cahier des charges est fusionné avec `loaded` (« Chargé – en route ») : un statut de moins, rien de perdu.

## 5. Fonctions Netlify

| Fonction | Actions ajoutées | Contrôle |
|---|---|---|
| `auth.mts` | `signup` (producteur), `update-profile`, `list-users`, `set-disabled`, `reset-password` | `signup` public + anti-abus ; le reste selon session / admin |
| `orders.mts` | `GET ?scope=mine` (producteur), `?scope=available` (partenaire, filtré catégorie + région) / `?scope=assigned` (partenaire), `GET ?id=` ; `POST ?id=&action=accept\|loaded\|delivered\|cancel` | rôle + propriétaire de la mission |
| `orders.mts` | `GET` admin avec filtres `from, to, status, product, route` | admin |
| `_lib/orders.ts` | `transition(order, action, session)` : table des transitions autorisées, ajout de l'événement ; `matchesTransporter(order, account, trucks)` : règle type + zone | testés avec le faux store Vitest existant |

Le login refuse un compte `disabled`. `handleSession` renvoie aussi le rôle `producer`.

## 6. Hors-ligne (PWA) — extension de `public/sw.js`

Le service worker actuel ne met en cache que la page `/offline`, les images de marque, les polices et `/_next/static`. On ajoute :

1. **Coquille des écrans clés** : précache de `/producteur`, `/producteur/demande/nouvelle`, `/producteur/demande`, `/partner`,
   `/partner/mission`, `/profil` (pages statiques de l'export → elles s'ouvrent hors ligne).
2. **Lectures** : `GET /.netlify/functions/orders*` et `auth?action=session` en *network-first* avec repli sur le cache :
   hors ligne, on voit les dernières missions connues et un bandeau « Hors ligne — données du JJ/MM HH:MM ».
3. **Écritures** : petite file d'attente dans IndexedDB (`lib/outbox.ts`, sans dépendance) pour « Publier la demande »,
   « J'ai chargé », « J'ai livré ». L'action est appliquée tout de suite à l'écran (« En attente d'envoi »), puis rejouée
   à l'événement `online` et à chaque ouverture de l'app (Background Sync n'est pas fiable partout sur Android).
   L'heure saisie hors ligne est envoyée avec l'action, pour que l'historique reste juste.
4. **Conflits** : c'est le serveur qui fait foi. « Accepter » ne passe **pas** par la file hors ligne (il faut être en ligne
   pour ne pas promettre une mission déjà prise). Si une action rejouée est refusée, on affiche le motif.
5. Monter `CACHE_NAME` (`agrotruck-shell-v2`) pour invalider l'ancien cache.

## 7. Sécurité minimale

- PIN et mots de passe hachés en scrypt (déjà le cas).
- **Un PIN à 4–6 chiffres se devine vite** : limiter les tentatives de connexion par numéro (ex. 5 échecs → blocage 15 min,
  compteur stocké dans Blobs). Sans ça, un PIN n'est pas acceptable.
- Même limitation sur `signup` (par numéro et par IP).
- HTTPS : fourni par Netlify ; le cookie est déjà `HttpOnly; Secure; SameSite=Lax`.
- Chaque action de mission vérifie le rôle **et** la propriété (seul le transporteur assigné peut marquer chargé ou livré).

## 8. Modèle économique (repères pour le produit, rien à coder au MVP)

- **Gratuit** : petits producteurs, transporteurs à un camion (créer / accepter / suivre / historique).
- **Coop / Acheteur, ~30 000 XOF/mois** : tableau de bord avancé, exports CSV/PDF, multi-utilisateurs (5), support prioritaire.
- **Transporteur Pro, ~20 000 XOF/mois** : plusieurs camions et chauffeurs (s'appuie sur « Mes camions »), statistiques par camion.
- **Licence projet / bailleur** : sur devis (déploiement régional, formation, rapports d'impact tirés de l'export).
- **Plus tard** : paiement Orange Money / MTN / PI-SPI et commission de 3 à 7 %.

Seul impact technique à anticiper : garder les exports et les indicateurs derrière des fonctions admin, pour pouvoir
les réserver plus tard à un plan payant (un champ `plan` sur `Account` suffira ; pas au MVP).

Lancement : phase 1 (0–6 mois) tout gratuit autour de Gabú, Bafatá et Bissau ; phase 2 (6–12 mois) offres pilotes
pour 2–3 coopératives et 1–2 exportateurs ; phase 3 (12 mois et plus) paiement mobile et licences projets.

## 9. Découpage en lots

1. **Données et règles** : `data/vehicle-categories.ts`, `data/zones.ts`, types `Account` et `Order` étendus, `_lib/orders.ts` (`transition`, `matchesTransporter`, filtres), tests Vitest.
2. **Comptes producteurs** : `signup`, limitation des tentatives, `disabled`, `/inscription`, `/profil`, redirection du login.
3. **Espace producteur** : `/producteur`, nouvelle demande, détail.
4. **Espace transporteur** : onglets de `/partner`, `/partner/mission`, acceptation avec écriture conditionnelle.
5. **Admin** : indicateurs sur `/admin`, `/admin/users`, filtres et exports CSV/PDF sur `/admin/orders`.
6. **Hors-ligne** : `sw.js` v2, `lib/outbox.ts`, bandeau hors ligne.

Chaque lot se livre seul et garde `pnpm lint`, `pnpm test` et `pnpm build` au vert.

## Décisions validées (2026-09-27)

1. **Contact** : une fois la mission acceptée, le producteur voit le transporteur ou son entreprise et le **numéro du transporteur**.
   Le numéro de Badora n'apparaît pas. (Pour les missions, cela remplace la règle « Badora seul interlocuteur visible »
   de la spec du 2026-08-18. Le catalogue public reste sous la seule marque Badora.)
2. **Inscription libre** pour les producteurs ; les transporteurs restent invités par Badora.
3. **Visibilité des missions** : seulement les transporteurs dont **le type de véhicule** et **la région** correspondent.
4. **PIN 4–6 chiffres** pour les nouveaux comptes, avec limitation des tentatives obligatoire.
5. **Types de véhicules** : liste simple et familière (Camion, Camionnette / pick-up, Moto tricycle, Tracteur + remorque,
   Semi-remorque), le camion en premier.
