# Missions — Lot 2 : comptes producteurs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inscription libre des producteurs (téléphone + PIN), connexion par PIN avec limite de tentatives, blocage de comptes,
réinitialisation du PIN par Badora, page `/profil` par rôle, redirection du login selon le rôle.

**Architecture:** Règles de comptes dans `_lib/accounts.ts`, limite de tentatives dans `_lib/rate-limit.ts` (Blobs), actions dans
`auth.mts`. `getActiveSession()` recharge le compte pour qu'un blocage prenne effet immédiatement dans toutes les fonctions.
Écrans en `"use client"` avec les composants UI existants.

**Tech Stack:** Next.js (export statique), Netlify Functions, Netlify Blobs, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-27-missions-transport-light.md` (sections 1, 2A, 5, 7 ; lot 2 de la section 9). Suit le lot 1.

## Global Constraints

- Pas d'inscription libre des transporteurs : `signup` crée toujours un rôle `producer`.
- PIN = 4 à 6 chiffres (`/^\d{4,6}$/`), haché en scrypt comme les mots de passe ; les comptes existants gardent leur mot de passe.
- Connexion : 5 échecs en 15 min par numéro → blocage 15 min (HTTP 429).
- Inscription : 20 par heure et par IP → blocage 1 h (valeur large, car beaucoup d'abonnés mobiles partagent la même IP).
- Un compte `disabled` ne peut ni se connecter (403) ni utiliser une session existante (401/403).
- Design inchangé : mêmes cartes, `Input`, `Select`, `Label`, `Button`.
- Tant que le lot 3 n'existe pas, un producteur arrive sur `/profil` (`homeForRole.producer`).

---

### Task 1: Règles de comptes et limite de tentatives

**Files:** Modify `netlify/functions/_lib/accounts.ts`, `netlify/functions/_lib/accounts.test.ts` ; Create `netlify/functions/_lib/rate-limit.ts`, `netlify/functions/_lib/rate-limit.test.ts`

**Interfaces (produites) :**
- `toPublicAccount(account): PublicAccount` (retire `passwordHash`).
- `updateProfile(id, input: ProfileInput): Promise<{ ok: true; account } | { ok: false; status: 404 | 409; error }>`.
  Champs gardés selon le rôle : communs `displayName`, `phone`, `companyName` ; partenaire + `vehicleCategories`,
  `vehicleCapacityTons`, `workZones` ; producteur + `mainZone`, `mainLocation`. Un changement de numéro réindexe
  et refuse un numéro déjà pris (409).
- `findAccountByPhone` ignore un index de numéro périmé (le numéro du compte doit correspondre).
- `setAccountDisabled(id, disabled)`, `setAccountPassword(id, password)` → `Account | null`.
- `isLocked(key, store?, now?)`, `recordAttempt(key, { max, windowMinutes, lockMinutes }, store?, now?)`, `clearAttempts(key, store?)`.

- [x] Tests d'abord (10 nouveaux) → FAIL ; implémentation → `pnpm test` PASS (60).

### Task 2: Fonction `auth` et sessions actives

**Files:** Modify `netlify/functions/auth.mts`, `netlify/functions/_lib/session.ts`, `netlify/functions/trucks.mts`, `netlify/functions/orders.mts`

- `getActiveSession(request)` dans `_lib/session.ts` remplace `getSessionFromRequest` dans toutes les fonctions.
- `auth.mts` :
  - GET : `session`, `profile`, `list-users[&role=]`, `list-partners` (conservé pour `/admin/partners`).
  - POST : `login` (limite + blocage), `logout`, `signup` (Zod : téléphone, PIN, région, localité ; crée un `producer` et ouvre la session),
    `update-profile` (réémet le cookie), `create-partner`, `set-disabled` (admin, pas sur soi-même), `reset-password` (admin).

- [x] `npx tsc --noEmit` OK ; test de bout en bout en mémoire (script temporaire supprimé) : PIN invalide → 400, inscription → 201 + session,
  numéro en double → 409, 5 échecs → 429, compte bloqué → 403 au login et 401 avec l'ancien cookie, déblocage, PIN réinitialisé, liste des producteurs.

### Task 3: Écrans

**Files:** Create `app/inscription/page.tsx`, `app/profil/page.tsx` ; Modify `app/login/page.tsx`, `components/auth/session-gate.tsx`,
`lib/use-session.ts` (`Role` + `homeForRole`), `scripts/seed-account.ts` (rôle `producer`)

- `/login` : libellé « PIN ou mot de passe », clavier téléphone, messages 401/403/429, lien « Créer un compte », redirection via `homeForRole`.
- `/inscription` : nom (facultatif), téléphone, PIN + confirmation (clavier numérique), région, village/ville.
- `/profil` : nom, téléphone, entreprise ; transporteur : puces « Mes véhicules » (catégories), capacité, puces « Régions où je charge » ;
  producteur : région + village/ville.
- `SessionGate` : accepte un ou plusieurs rôles ; un rôle non autorisé est renvoyé vers son propre espace ; lien « Mon profil » dans la barre de session.

- [x] `pnpm lint` 0 erreur, `pnpm test` 60/60, `pnpm build` OK (`/inscription`, `/profil` générés).

## Self-Review Notes

- Couverture du lot 2 : signup, limites, `disabled`, `/inscription`, `/profil`, redirection du login : tout y est.
  Actions admin `list-users`, `set-disabled` et `reset-password` prêtes ; leur écran (`/admin/users`) vient au lot 5.
- Hors périmètre : « Mot de passe oublié » par SMS (plus tard) ; au MVP, Badora réinitialise le PIN.
