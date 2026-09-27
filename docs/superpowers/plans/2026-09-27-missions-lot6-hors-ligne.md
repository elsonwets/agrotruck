# Missions — Lot 6 : hors-ligne — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Les écrans clés s'ouvrent sans réseau avec les dernières données connues. « Publier la demande », « chargé » et « livré » faits hors ligne sont gardés sur le téléphone et envoyés automatiquement au retour du réseau, sans doublon.

**Architecture:**
- `public/sw.js` v2 : coquille précachée ; pages en réseau d'abord ; données (missions, session, profil, mes camions) en réseau d'abord avec la dernière réponse en secours. Il prévient la page des états « hors ligne » et « réseau revenu ».
- `lib/outbox.ts` : file IndexedDB testable (stockage et réseau injectables).
- `lib/mission-actions.ts` : envoie ou met en file, et applique localement la même `transition()` que le serveur (déplacée dans `lib/missions.ts`).
- `OfflineBanner` : affiche l'état et déclenche la reprise.

**Tech Stack:** Service Worker (Cache Storage), IndexedDB, Next.js (export statique), Netlify Functions, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-27-missions-transport-light.md` (section 6 ; lot 6). Suit les lots 1 à 5.

## Global Constraints

- « Accepter » et « Annuler » ne passent jamais par la file : il faut être en ligne.
- Le serveur fait foi. Un refus au rejeu (4xx) est retiré de la file et affiché ; une erreur serveur (5xx) ou un réseau coupé arrête le rejeu et garde la suite.
- L'heure réelle de l'action est envoyée avec elle ; le serveur l'accepte si elle n'est pas dans le futur.
- Une demande publiée hors ligne porte un identifiant choisi par le téléphone (`clientRequestId`) : la rejouer ne crée pas de doublon.
- Déconnexion : on envoie ce qui peut l'être, puis on vide la file et le cache de données (téléphone partagé).
- Aucune dépendance ajoutée.

---

### Task 1: Règles partagées
**Files:** Modify `lib/missions.ts` (reçoit `transition`, `Actor`, `OrderAction`, `TransitionResult`), `netlify/functions/_lib/orders.ts` (réexport).
- [x] 77/77 inchangé.

### Task 2: File d'attente (TDD)
**Files:** Create `lib/outbox.ts`, `lib/outbox.test.ts`.

**Interfaces :**
- `createOutbox(storage, fetcher, isOnline, onChange?)` → `{ submit, flush, list, clear }`.
- `submit(input)` → `{ status: "sent", response } | { status: "queued", item }`.
- `flush()` → `{ sent, rejected, remaining }`.
- `memoryStorage()` ; `getOutbox()` (IndexedDB `agrotruck/outbox`, événement `agrotruck:outbox`).

- [x] 8 tests d'abord → FAIL : envoi direct, hors ligne, coupure en cours, refus non mis en file, rejeu dans l'ordre, arrêt si coupure, refus signalé et 5xx gardé, rien si hors ligne. Puis → PASS (85).

### Task 3: Création sans doublon
**Files:** Modify `netlify/functions/orders.mts` (`clientRequestId` ; déjà existant → même mission), `netlify/functions/_lib/orders.ts` (`createOrder` accepte `id`), `orders.test.ts`.
- [x] Test « garde l'identifiant du client » → FAIL puis PASS (86).

### Task 4: Service worker et bandeau
**Files:** Modify `public/sw.js`, `lib/use-session.tsx` (déconnexion), `app/layout.tsx` ; Create `components/pwa/offline-banner.tsx`.

- [x] **Précache** : `/`, `/login`, `/profil`, `/producteur`, `/producteur/demande`, `/producteur/demande/nouvelle`, `/partner`, `/partner/mission`, plus les fichiers `/_next/static` que chaque page référence.
- [x] **Navigation hors ligne** : page en cache, même avec un `?id=`, sinon `/offline`.
- [x] **Données en cache** marquées `x-agrotruck-cached-at`. Messages vers la page : `offline-data` (avec la date) et `online-data`.
- [x] **Bandeau** : « Hors ligne — données du … », « N actions en attente », « N actions envoyées » avec un bouton Actualiser, ou le motif d'un refus.
- [x] **Rejeu** : à l'ouverture de l'application, à l'événement `online`, au message `online-data`, et toutes les 30 s tant que des actions attendent (réseau faible sans événement `online`).

### Task 5: Écrans
**Files:**
- Create `lib/mission-actions.ts`.
- Modify `components/missions/mission-parts.tsx` (`pendingSync`, `PendingSyncBadge`), `app/producteur/page.tsx`, `app/producteur/demande/page.tsx`, `app/producteur/demande/nouvelle/page.tsx`, `app/partner/mission/page.tsx`, `components/partner/available-missions.tsx`.

- [x] **Publier une demande** : passe par la file avec un `clientRequestId`. En file, retour à « Mes transports », où la demande apparaît « En attente d'envoi » (carte en pointillés) ; la liste se recharge quand elle part.
- [x] **Chargé / Livré** (producteur et transporteur) : envoi ou mise en file, état appliqué tout de suite et badge « En attente d'envoi ». Après un rechargement, les actions encore en file sont réappliquées (`withQueuedActions`).
- [x] **Accepter et Annuler** : message clair hors ligne (« Connexion nécessaire pour … »).

### Vérification
- [x] `tsc` 0 erreur, `pnpm lint` 0 erreur, `pnpm test` 86/86, `pnpm build` OK, `sw.js` syntaxe OK.
- [x] **Navigateur, export statique servi en local, service worker actif** :
  - 51 entrées en coquille et données en cache après une visite ;
  - serveur coupé : `/producteur/demande/nouvelle` s'ouvre, la session est conservée, le bandeau « Hors ligne — données du 27/09/2026 16:05 » s'affiche.
- [ ] **Non vérifié dans le navigateur** : la publication hors ligne puis le rejeu au retour du réseau. L'outil de navigateur ne met pas à jour l'état React des champs (`form_input`), et ses captures devenaient instables. Ce parcours est couvert par les tests de `lib/outbox.ts` et de `createOrder` ; à refaire à la main sur un téléphone (mode avion).

## Self-Review Notes

- Couverture de la section 6 de la spec : les 5 points sont traités (coquille, lectures, écritures, conflits, `CACHE_NAME` v2).
- **Service worker actif en production seulement** (`PwaRegister`). Pour tester en local : `pnpm build`, puis servir `out/` avec les fonctions sur :9999.
