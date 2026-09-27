# AgroTrucks

Plateforme de transport agricole en Guinée-Bissau : producteurs et coopératives publient leurs besoins de transport, les transporteurs de la région (bon type de véhicule + bonne région) les acceptent, et chacun suit la mission jusqu'à la livraison. Catalogue public de véhicules (transport, location, vente), en **français, anglais et portugais**. Gratuit pendant le lancement.

## Stack

- **TanStack Start** (React 19, rendu serveur pour le SEO) — `src/`
- **Convex** (base de données, logique métier, stockage des photos) — `convex/`
- **Tailwind CSS 4**, sans bibliothèque d'animation (site rapide sur Android bas de gamme)
- Hébergement **Vercel** (sortie produite par Nitro)
- PWA hors ligne : `public/sw.js` + file d'attente IndexedDB (`src/shared/outbox.ts`)

```
convex/            schéma, fonctions (auth, users, trucks, missions), tests convex-test
src/shared/        règles métier partagées navigateur + Convex (missions, file hors ligne, régions)
src/i18n/          dictionnaires fr / en / pt (le français est la référence typée)
src/routes/        pages : /$lang/... (publiques, espace producteur, transporteur, admin), sitemap.xml, robots.txt
src/components/    interface
```

## Développement

```bash
pnpm install
pnpm dev:backend   # Convex : base locale (sans compte) ou votre projet Convex ; écrit VITE_CONVEX_URL dans .env.local
pnpm dev           # site sur http://localhost:3000 (dans un second terminal)
```

Sans compte Convex, la première commande peut se lancer en base locale : `CONVEX_AGENT_MODE=anonymous npx convex dev`.
Pour relier votre compte plus tard : `npx convex login` puis `npx convex dev`.

### Premier compte administrateur

Producteurs et transporteurs s'inscrivent eux-mêmes sur `/{langue}/signup`. L'administrateur se crée une seule fois :

```bash
npx convex run users:bootstrapAdmin '{"phone":"+245…","pin":"123456","displayName":"Administrateur"}'
```

(Refusé dès qu'un administrateur existe.)

## Vérifications

```bash
pnpm check   # typecheck + lint + tests (règles partagées et fonctions Convex)
pnpm build
```

## Mise en ligne (Vercel)

1. Créer un projet Convex de production : `npx convex deploy` (ou depuis le tableau de bord Convex), récupérer une **Deploy Key**.
2. Sur Vercel : importer le dépôt, commande de build
   `npx convex deploy --cmd 'pnpm build'`,
   variables d'environnement `CONVEX_DEPLOY_KEY` (production) et `VITE_SITE_URL` (ex. `https://agro-truck.com`).
3. Créer l'administrateur sur la base de production avec `npx convex run --prod users:bootstrapAdmin …`.

## SEO

Chaque page publique a titre, description, URL canonique, `hreflang` (fr, en, pt, x-default), Open Graph, Twitter et données structurées (Organization, WebSite, FAQPage, Vehicle, BreadcrumbList). `/sitemap.xml` liste toutes les pages publiques et annonces dans les 3 langues ; `/robots.txt` exclut les espaces privés. `/` redirige vers la langue du navigateur (portugais par défaut).
