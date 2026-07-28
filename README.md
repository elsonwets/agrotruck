# AgroTruck

Plateforme Next.js de mise en relation entre les personnes qui recherchent un truck disponible et les propriétaires de trucks en Guinée-Bissau et au Sénégal.

## Développement

```bash
pnpm install
pnpm dev
```

L’application est ensuite disponible sur `http://localhost:3000`.

## Base de données Neon

Le projet utilise Neon Postgres avec Drizzle ORM et le pilote serverless HTTP.

1. Dans le dashboard Neon, utilisez **Connect** et copiez la chaîne de connexion.
2. Copiez `.env.example` vers `.env.local`.
3. Renseignez `DATABASE_URL` et une valeur aléatoire longue pour `VERIFICATION_CODE_SECRET`.
4. Appliquez le schéma puis chargez les huit trucks de démonstration :

```bash
pnpm db:migrate
pnpm db:seed
```

Commandes disponibles :

```bash
pnpm db:generate  # générer une migration après modification du schéma
pnpm db:migrate   # appliquer les migrations à Neon
pnpm db:push      # synchronisation directe, réservée au développement
pnpm db:seed      # charger les données de démonstration
```

La connexion peut être vérifiée sur `/api/health/database`. Cet endpoint ne retourne jamais la chaîne de connexion.

Les données statiques restent utilisées comme fallback local quand `DATABASE_URL` n’est pas définie.

## Vérifications

```bash
pnpm lint
pnpm build
```
