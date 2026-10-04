# AgroTrucks by Badora — Gestion de flotte et suivi GPS

Date : 2026-10-04
Statut : validé en discussion (décisions du 2026-10-04), en attente de relecture de la spec
Précédent : `2026-09-27-missions-transport-light.md` (missions, offres, espaces producteur et transporteur)

## Objectif

Donner aux transporteurs qui ont plusieurs camions un **tableau de bord de flotte** (liste des véhicules + carte
OpenStreetMap avec la position de chaque conducteur), permettre aux conducteurs **sans compte** de partager leur
position par un lien WhatsApp, et montrer aux producteurs et visiteurs une **liste publique « Camions en direct »**
avec le statut de chaque camion — sans jamais publier de coordonnées.

Références visuelles : capture « FleetTrack » (grille de cartes camions, liste publique) et capture « Fleet Overview »
(compteurs, liste à gauche, carte à droite, tableau de bord transporteur).

## Décisions

| Sujet | Décision |
|---|---|
| Source des positions | Hybride. Entreprise : lien unique envoyé au conducteur par WhatsApp, sans compte. Transporteur particulier : partage depuis son compte, sur la page de la mission. |
| Accès « Pro » (flotte) | Automatique dès que le transporteur possède **2 camions ou plus**. Calculé côté serveur, aucun champ stocké. |
| Visibilité des positions | Propriétaire du camion, producteur de la mission en cours sur ce camion (`assigned` ou `loaded`), admin. La liste publique n'affiche que le statut, jamais de coordonnées. |
| Barre de progression | Coordonnées fixes du centre de chaque région. Progression = part de la distance déjà parcourue entre la zone de départ et la zone d'arrivée. Trajet dans une même région : la barre suit les étapes de la mission. |
| Carte | Leaflet + tuiles OpenStreetMap, chargé seulement sur les pages qui ont une carte. Pas de MapLibre/WebGL (Android bas de gamme). |
| Temps réel | Requêtes réactives Convex. Pas de WebSocket ni d'infrastructure en plus. |
| Historique de trajet | Aucun : on ne garde que la dernière position de chaque camion. |
| Statuts « En retard » / « Problème détecté » | Hors périmètre : sans heure d'arrivée prévue, on ne peut pas les calculer de façon fiable. |

## 1. Modèle de données (Convex)

### Nouvelles tables

**`drivers`** : conducteurs d'une entreprise (pas de compte, pas de mot de passe).

| Champ | Type | Note |
|---|---|---|
| `ownerId` | `id("users")` | transporteur propriétaire |
| `name` | `string` | |
| `phone` | `string` | numéro WhatsApp, utilisé pour le lien `wa.me` |
| `truckId` | `optional(id("trucks"))` | camion affecté (doit appartenir au même propriétaire) |
| `disabled` | `boolean` | un conducteur désactivé ne peut plus envoyer de position |
| `updatedAt` | `number` | |

Index : `by_ownerId`.

**`trackingLinks`** : liens de partage envoyés aux conducteurs.

| Champ | Type | Note |
|---|---|---|
| `ownerId` | `id("users")` | |
| `driverId` | `id("drivers")` | |
| `truckId` | `id("trucks")` | camion dont on met à jour la position |
| `missionId` | `optional(id("missions"))` | facultatif, simple information |
| `tokenHash` | `string` | SHA-256 du jeton, le jeton en clair n'est jamais stocké |
| `expiresAt` | `number` | création + 7 jours |
| `revokedAt` | `optional(number)` | |

Index : `by_tokenHash`, `by_driverId`, `by_expiresAt`.
Créer un nouveau lien pour un conducteur révoque ses liens encore actifs : un seul lien valide par conducteur.

**`positions`** : **une ligne par camion**, la dernière position connue, mise à jour à chaque envoi.

| Champ | Type | Note |
|---|---|---|
| `truckId` | `id("trucks")` | |
| `lat`, `lng` | `number` | |
| `accuracy` | `optional(number)` | mètres |
| `speed` | `optional(number)` | m/s |
| `heading` | `optional(number)` | degrés |
| `at` | `number` | horodatage serveur de la réception |
| `source` | `"owner" \| "link"` | |
| `driverId` | `optional(id("drivers"))` | renseigné quand `source = "link"` |

Index : `by_truckId`.

### Tables modifiées

- **`trucks`** : on ajoute `plate: optional(string)` (la plaque) et `driverId: optional(id("drivers"))`
  (conducteur affiché). L'affectation est gardée en cohérence des deux côtés par les mutations des conducteurs.
  Le champ « Plaque » est ajouté au formulaire camion existant (`trucks.create` / `trucks.update`).
- **`src/shared/zones.ts`** : on ajoute `lat` et `lng` (centre approximatif) à chacune des 9 régions.

### Règle « Pro »

`isFleetOwner(ctx, userId)` = au moins 2 documents `trucks` avec `ownerId = userId` (index `by_ownerId`, `take(2)`).
Les fonctions de flotte et de conducteurs renvoient `forbidden` si la règle n'est pas remplie. Si un transporteur
redescend à un seul camion, ses conducteurs et liens existants restent en base, mais ne sont plus gérables, et
`reportFromLink` refuse les envois pour ce propriétaire.

## 2. Écrans

Tous les nouveaux écrans reprennent les composants existants (`PageTitle`, `EmptyState`, `Badge`, `buttonClass`,
cartes `rounded-[var(--radius-card)] border border-line bg-white`) et sont traduits en pt / fr / en.

### Transporteur Pro : `/$lang/transporter/fleet`

- **4 compteurs :** total, en route, disponibles, en maintenance.
- **Liste des véhicules :** nom, plaque, conducteur, badge de statut, « dernière mise à jour il y a X min ».
  Filtres par statut et recherche par nom ou plaque, côté client.
- **Carte Leaflet :** un repère numéroté par camion qui a une position. Au clic, une bulle affiche le camion, le
  conducteur et l'heure du dernier signal. Au-delà de 10 min sans signal, le repère passe en gris (« signal perdu »).
  Ce seuil est calculé côté client, car les requêtes Convex ne lisent pas l'horloge.
- **Mobile :** onglets « Liste / Carte » à la place des deux colonnes. Grand écran : deux colonnes.
- Un onglet « Flotte » est ajouté à `space-nav.tsx`, visible seulement pour un transporteur Pro.

### Gestion des conducteurs : `/$lang/transporter/drivers` (Pro)

- Liste, ajout, modification, désactivation d'un conducteur, affectation d'un camion.
- **« Envoyer le lien »** : appelle `tracking.createLink`, reçoit le jeton en clair (une seule fois), puis ouvre
  `https://wa.me/<téléphone>?text=…` avec un message prérempli dans la langue du transporteur, contenant
  `https://<site>/<lang>/track/<jeton>`.
- **« Révoquer »** : coupe le lien actif du conducteur.
- Un onglet « Conducteurs » est ajouté à `space-nav.tsx`, visible seulement pour un transporteur Pro.

### Page du conducteur : `/$lang/track/$token` (sans compte)

- Page minimale, sans en-tête lourd. Nom du camion et du conducteur, grand bouton « Démarrer le partage » /
  « Arrêter », état en clair (« Position envoyée il y a 12 s », « Hors ligne », « Partage en pause »).
- Wake Lock pendant le partage, quand le navigateur le permet. Un message rappelle de garder la page ouverte.
- Lien expiré, révoqué ou conducteur désactivé : message clair, pas de bouton.
- `noindex`, exclue du sitemap.

### Transporteur particulier : `/$lang/transporter/missions/$missionId`

- Quand la mission lui est assignée et a le statut `assigned` ou `loaded`, et qu'elle a un `truckId`, un bouton
  « Partager ma position » utilise le même composant de partage que la page du conducteur, mais envoie avec
  `reportFromOwner`. Ce bouton est disponible pour tous les transporteurs, Pro ou non.

### Producteur : `/$lang/producer/missions/$missionId`

- Pour une mission `assigned` ou `loaded` avec un `truckId` : mini-carte Leaflet avec la position du camion, barre
  de progression, conducteur (prénom) et heure du dernier signal. Sans position : « Position pas encore partagée ».

### Public : `/$lang/fleet`, « Camions en direct »

- Grille de cartes façon FleetTrack : photo, nom, plaque, badge de statut, prénom du conducteur, barre de
  progression (missions en cours), capacité, note.
- Filtres : Tous / Disponible / En chargement / En route / Maintenance.
- Ne liste que les camions non masqués (`hidden = false`). **Aucune coordonnée et aucun numéro de téléphone de
  conducteur** dans la réponse de la requête.
- Lien ajouté au menu principal (`header.tsx`), page ajoutée au sitemap, SEO trilingue comme les autres pages publiques.

### Statut affiché (fonction pure partagée)

| Statut affiché | Condition (dans cet ordre) |
|---|---|
| En route | mission en cours du camion avec le statut `loaded` |
| En chargement | mission en cours du camion avec le statut `assigned` |
| Maintenance | `trucks.availability = "maintenance"` |
| Disponible | sinon |

La « mission en cours » d'un camion est la mission la plus récente avec ce `truckId` et un statut `assigned` ou
`loaded`. Pour la retrouver sans balayer la table, on ajoute l'index `missions.by_truckId_and_status`.

## 3. Flux des données

### Envoi d'une position

1. Le navigateur suit la position avec `navigator.geolocation.watchPosition` (`enableHighAccuracy: true`).
2. Il n'envoie un point que si 30 s se sont écoulées depuis le dernier envoi **ou** s'il a bougé de plus de 100 m
   (fonction pure `shouldSend(last, next, now)`).
3. Il appelle `tracking.reportFromLink({ token, lat, lng, accuracy?, speed?, heading? })` pour un conducteur, ou
   `tracking.reportFromOwner({ token: session, truckId, lat, lng, … })` pour un transporteur particulier.
4. La mutation valide les droits et les valeurs, puis met à jour (ou crée) la ligne `positions` du camion, avec
   `at` = l'heure du serveur.
5. Les requêtes réactives (`fleet.overview`, `tracking.missionPosition`) poussent la nouvelle position aux écrans ouverts.

### Fonctions Convex

| Fonction | Type | Accès |
|---|---|---|
| `drivers.list`, `drivers.create`, `drivers.update`, `drivers.setDisabled` | query / mutation | propriétaire Pro |
| `tracking.createLink({ token, driverId })` → jeton en clair | mutation | propriétaire Pro, conducteur actif avec un camion affecté |
| `tracking.revokeLink({ token, driverId })` | mutation | propriétaire Pro |
| `tracking.linkInfo({ linkToken })` | query | public. Renvoie nom du camion, prénom du conducteur et validité, rien d'autre |
| `tracking.reportFromLink` | mutation | jeton de lien valide |
| `tracking.reportFromOwner` | mutation | transporteur propriétaire du camion, avec une mission `assigned`/`loaded` sur ce camion |
| `tracking.missionPosition({ token, missionId })` | query | producteur de la mission (si en cours), transporteur de la mission, admin |
| `fleet.overview({ token })` | query | propriétaire Pro. Camions, conducteurs, positions, statut affiché, progression |
| `fleet.publicList({})` | query | public. Statut, prénom du conducteur, progression, sans coordonnées |
| `tracking.purgeExpiredLinks` | internalMutation | cron horaire, ajouté à `crons.ts` |

## 4. Sécurité

- Jeton de lien : 32 octets aléatoires (encodage base64url). Le serveur ne stocke que l'empreinte SHA-256
  (`lib/security.ts`, même méthode que les sessions).
- `reportFromLink` refuse si le lien est introuvable, expiré, révoqué, si le conducteur est désactivé, si le camion
  n'est plus affecté à ce conducteur, ou si le propriétaire n'est plus Pro. Erreur `ConvexError({ code: "link_invalid" })`.
- Validation des valeurs : `lat` entre -90 et 90, `lng` entre -180 et 180, `accuracy` positive. Un point dont la
  précision dépasse 1 000 m est ignoré.
- Limitation : un point au plus toutes les 10 s par camion (on compare avec `positions.at`). Les envois trop
  rapprochés sont ignorés sans erreur.
- Toutes les mutations de conducteurs et de liens vérifient `ownerId === utilisateur de la session`, et que le
  camion affecté appartient au même propriétaire.
- `fleet.publicList` et `tracking.linkInfo` ne renvoient jamais de coordonnées ni de numéro de téléphone.

## 5. Erreurs et cas limites

- **Géolocalisation refusée :** la page explique comment l'autoriser dans le navigateur.
- **Hors connexion :** on n'utilise pas la file d'attente hors ligne existante (`outbox`), car une vieille position
  n'a pas de valeur. La page affiche « Hors ligne » et l'envoi reprend dès que le réseau revient.
- **Onglet en arrière-plan** (`visibilitychange`) : la page affiche « Partage en pause, gardez la page ouverte ».
  Une PWA ne peut pas suivre la position en arrière-plan.
- **Camion sans position :** pas de repère sur la carte, « Aucun signal » dans la liste.
- **Camion supprimé :** sa ligne `positions` est supprimée, et les conducteurs et liens qui le visaient sont détachés
  ou révoqués (à faire dans la mutation de suppression existante de `trucks.ts`).

## 6. Tests

**`convex-test`** (`convex/tracking.test.ts`, `convex/fleet.test.ts`)
- Lien : jeton valide accepté, jeton expiré, révoqué ou faux refusé, conducteur désactivé refusé. Un nouveau lien
  révoque l'ancien.
- Limitation : deux envois à moins de 10 s d'écart, seul le premier est enregistré.
- Lecture : le propriétaire voit les positions, le producteur de la mission en cours aussi, un autre producteur est
  refusé, et le producteur est refusé une fois la mission livrée.
- `fleet.publicList` ne contient aucun champ `lat`, `lng` ni téléphone.
- Règle Pro : refus avec 1 camion, accès avec 2.
- `reportFromOwner` refusé sans mission en cours sur le camion.

**Vitest, fonctions pures** (`src/shared/fleet.test.ts`)
- `progress(pickupZone, dropoffZone, position, missionStatus)` : 0 au départ, environ 0,5 à mi-chemin, bornée entre
  0 et 1, repli sur les étapes quand les deux zones sont identiques ou qu'il n'y a pas de position.
- `displayStatus(truck, currentMission)` : chaque ligne du tableau de la section 2.
- `shouldSend` : 30 s, 100 m, premier point toujours envoyé.

## Hors périmètre

- Historique et tracé des trajets, replay.
- Heure d'arrivée prévue, statuts « En retard » et « Problème détecté ».
- Balises GPS matérielles.
- Suivi en arrière-plan (application native).
- Paiement de l'offre Pro.
- Point exact de départ et d'arrivée posé sur la carte (on pourra le substituer plus tard aux centres de zones).
