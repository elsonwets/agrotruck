# AgroTrucks by Badora

Plateforme logistique de Badora : Badora et ses partenaires transporteurs (invités par Badora) publient leurs camions, Badora valide chaque annonce avant publication, et les clients demandent une location — sans prix affiché — via un formulaire qui part ensuite vers WhatsApp.

Le site reste un export statique Next.js déployé sur Netlify (`output: "export"`). Toute la logique dynamique (comptes, camions, modération) vit dans des Netlify Functions (`netlify/functions/`) adossées à Netlify Blobs. Les pages publiques (`/`, `/trucks`, `/trucks/[slug]`, `/location`) sont générées au build à partir de la fonction `trucks` ; les espaces authentifiés (`/login`, `/partner`, `/admin`) appellent les fonctions directement à l'exécution, donc toujours à jour.

## Développement

```bash
pnpm install
pnpm dev            # site Next.js sur http://localhost:3000
pnpm dev:functions  # Netlify Functions + Blobs locaux sur :9999 (second terminal)
```

En dev, `next dev` relaie `/.netlify/functions/*` vers `:9999` (voir `next.config.ts`) : connexion, espace partenaire, admin et demandes clients fonctionnent donc sur `http://localhost:3000`. Les données locales sont stockées dans `.netlify/blobs-serve`. Sans `URL` défini, les pages publiques utilisent les données de démonstration de `data/trucks.ts`.

Variables nécessaires dans `.env.local` (voir `.env.example`) :

- `SESSION_SECRET` — secret de signature des cookies de session.
- `NETLIFY_BUILD_HOOK_URL` — optionnel en local ; déclenche un rebuild du site à chaque publication/modification de camion en production.
- `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_AGROTRUCK_WHATSAPP` — inchangés.

## Comptes

Les producteurs et coopératives s'inscrivent eux-mêmes sur `/inscription` (téléphone + PIN de 4 à 6 chiffres). Les transporteurs (`partner`) ne s'inscrivent pas : un compte `admin` les crée depuis `/admin/users`. Connexion limitée à 5 essais par 15 minutes et par numéro. Pour créer un compte en ligne de commande (bac à sable local, ou store Netlify si `NETLIFY_SITE_ID` / contexte Blobs est défini) :

```bash
pnpm seed:account +245955000100 "Badora" "un-mot-de-passe-fort"             # admin
pnpm seed:account +245955000200 "Transports X" "mot-de-passe" partner       # partenaire
pnpm seed:account +245955000300 "Coop Pirada" "1234" producer               # producteur
```

Puis connectez-vous sur `/login` : un admin arrive sur `/admin`, un partenaire sur `/partner`, un producteur sur `/profil`.

## Vérifications

```bash
pnpm lint
pnpm test
pnpm build
```
