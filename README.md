# AgroTrucks by Badora

Plateforme logistique de Badora : Badora et ses partenaires transporteurs (invités par Badora) publient leurs camions, Badora valide chaque annonce avant publication, et les clients demandent une location — sans prix affiché — via un formulaire qui part ensuite vers WhatsApp.

Le site reste un export statique Next.js déployé sur Netlify (`output: "export"`). Toute la logique dynamique (comptes, camions, modération) vit dans des Netlify Functions (`netlify/functions/`) adossées à Netlify Blobs. Les pages publiques (`/`, `/trucks`, `/trucks/[slug]`, `/location`) sont générées au build à partir de la fonction `trucks` ; les espaces authentifiés (`/login`, `/partner`, `/admin`) appellent les fonctions directement à l'exécution, donc toujours à jour.

## Développement

```bash
pnpm install
pnpm dev
```

L'application est disponible sur `http://localhost:3000`. `pnpm dev` seul ne sert pas les Netlify Functions — sans `URL` défini dans l'environnement, `lib/truck-directory.ts` retombe sur les données de démonstration de `data/trucks.ts`. Pour travailler sur les comptes, la publication ou la modération, utilisez `netlify dev` (Netlify CLI), qui sert le site et les fonctions ensemble.

Variables nécessaires dans `.env.local` (voir `.env.example`) :

- `SESSION_SECRET` — secret de signature des cookies de session.
- `NETLIFY_BUILD_HOOK_URL` — optionnel en local ; déclenche un rebuild du site à chaque publication/modification de camion en production.
- `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_AGROTRUCK_WHATSAPP` — inchangés.

## Comptes

Aucune inscription libre. Seul un compte `admin` peut créer un compte `partner` (depuis `/admin/partners`). Pour créer le premier compte admin :

```bash
pnpm seed:admin +245955000100 "Badora" "un-mot-de-passe-fort"
```

## Vérifications

```bash
pnpm lint
pnpm test
pnpm build
```
