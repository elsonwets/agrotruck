# Demandes clients & tableau de bord logistique Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a client describe the trucks they need (count, type, route, date, cargo) on `/location`, have that request land as a pre-filled WhatsApp message to Badora, and give Badora a history of every request in the admin dashboard.

**Architecture:** Same stack as the first plan (`docs/superpowers/plans/2026-08-18-comptes-camions-moderation.md`): a Netlify Function (`netlify/functions/orders.mts`) backed by Netlify Blobs stores the request; the WhatsApp message is built client-side with the existing `whatsappUrl()` helper (`lib/utils.ts`) — no WhatsApp Business API, no server-side send, matching the already-approved design. Creating an order never triggers a rebuild: orders are admin-only data, never rendered on a public static page. The admin order history is a new authenticated, client-rendered page (`/admin/orders`), reusing the `SessionGate` component from the first plan.

**Tech Stack:** Same as the first plan — Next.js static export, Netlify Functions (`.mts`), `@netlify/blobs`, Zod, Vitest. This plan depends on the first plan being implemented (it reuses `SessionGate`, `useSession`, `getSessionFromRequest`, `truckTypeLabels`, and `whatsappUrl`), but adds no new subsystem to it — it can be built, tested, and shipped independently once those exist.

**Spec:** `docs/superpowers/specs/2026-08-18-agrotrucks-badora-design.md`

## Global Constraints

- No price field anywhere — the order form never asks for or shows a budget/price.
- An `Order` is a request, not a reservation: it names a truck count, type, and route, never a specific truck id.
- The WhatsApp handoff stays "client clicks Send" (`wa.me` link opened by the browser) — never an automated server-side send.
- Creating an order never calls `triggerRebuild()` — orders are never rendered on a public static page.
- Reuse `types/order.ts`'s `Order` type as-is (already created in the first plan): `{ id, requestedTruckCount, truckType, pickupLocation, dropoffLocation, neededFrom, cargoDescription, clientName, clientPhone, createdAt }`.

---

## Task 1: Order store

**Files:**
- Create: `netlify/functions/_lib/orders.ts`
- Test: `netlify/functions/_lib/orders.test.ts`

**Interfaces:**
- Consumes: `Order` from `types/order.ts`; `BlobStore` from `./accounts` (defined in the first plan).
- Produces: `createOrder(input: Omit<Order, "id" | "createdAt">, store?: BlobStore): Promise<Order>`, `listOrders(store?: BlobStore): Promise<Order[]>` (newest first) — consumed by `orders.mts` (Task 2).

- [ ] **Step 1: Write the failing tests**

```ts
// netlify/functions/_lib/orders.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { createOrder, listOrders } from "./orders";
import type { BlobStore } from "./accounts";

function fakeStore(): BlobStore {
  const data = new Map<string, string>();
  return {
    async setJSON(key, value) { data.set(key, JSON.stringify(value)); },
    async get(key) { return data.has(key) ? JSON.parse(data.get(key)!) : null; },
    async list({ prefix }: { prefix: string }) { return { blobs: [...data.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })) }; },
  };
}

const baseInput = {
  requestedTruckCount: 3, truckType: "dump_truck", pickupLocation: "Bissau", dropoffLocation: "Bafatá",
  neededFrom: "2026-08-20", cargoDescription: "Sable et gravier", clientName: "Fatumata Camará", clientPhone: "+245955000900",
};

describe("order store", () => {
  let store: BlobStore;
  beforeEach(() => { store = fakeStore(); });

  it("creates an order with a generated id and timestamp", async () => {
    const order = await createOrder(baseInput, store);
    expect(order.id).toBeTruthy();
    expect(order.createdAt).toBeTruthy();
    expect(order.requestedTruckCount).toBe(3);
  });

  it("lists orders newest first", async () => {
    const first = await createOrder(baseInput, store);
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await createOrder({ ...baseInput, clientName: "João Có" }, store);
    const orders = await listOrders(store);
    expect(orders.map((order) => order.id)).toEqual([second.id, first.id]);
  });

  it("returns an empty list when there are no orders", async () => {
    expect(await listOrders(store)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — `./orders` does not exist yet.

- [ ] **Step 3: Implement `_lib/orders.ts`**

```ts
// netlify/functions/_lib/orders.ts
import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import type { Order } from "../../../types/order";
import type { BlobStore } from "./accounts";

function defaultStore(): BlobStore {
  return getStore("agrotruck-orders") as unknown as BlobStore;
}

export async function createOrder(input: Omit<Order, "id" | "createdAt">, store: BlobStore = defaultStore()): Promise<Order> {
  const order: Order = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
  await store.setJSON(`by-id/${order.id}`, order);
  return order;
}

export async function listOrders(store: BlobStore = defaultStore()): Promise<Order[]> {
  const { blobs } = await store.list({ prefix: "by-id/" });
  const orders = await Promise.all(blobs.map(({ key }) => store.get(key) as Promise<Order>));
  return orders
    .filter((order): order is Order => Boolean(order))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/orders.ts netlify/functions/_lib/orders.test.ts
git commit -m "feat: add order store"
```

---

## Task 2: `orders.mts` Netlify Function

**Files:**
- Create: `netlify/functions/orders.mts`

**Interfaces:**
- Consumes: `createOrder`, `listOrders` from `./_lib/orders` (Task 1); `getSessionFromRequest` from `./_lib/session` (first plan); `z` from `zod`.
- Produces: `POST` (public, no auth) → validates and creates an order, returns `201 Order`; `GET` (admin session required) → `200 Order[]`, newest first.

- [ ] **Step 1: Implement `orders.mts`**

```ts
// netlify/functions/orders.mts
import { z } from "zod";
import { createOrder, listOrders } from "./_lib/orders";
import { getSessionFromRequest } from "./_lib/session";

const orderInputSchema = z.object({
  requestedTruckCount: z.coerce.number().int().positive(),
  truckType: z.string().min(1),
  pickupLocation: z.string().min(1),
  dropoffLocation: z.string().min(1),
  neededFrom: z.string().min(1),
  cargoDescription: z.string().default(""),
  clientName: z.string().min(1),
  clientPhone: z.string().min(1),
  website: z.string().optional(), // honeypot — real clients never fill this
});

const handler = async (request: Request) => {
  if (request.method === "GET") return handleList(request);
  if (request.method === "POST") return handleCreate(request);
  return json({ error: "Méthode non autorisée" }, 405);
};

export default handler;

async function handleList(request: Request) {
  const session = getSessionFromRequest(request);
  if (session?.role !== "admin") return json({ error: "Réservé à Badora" }, 403);
  return json(await listOrders());
}

async function handleCreate(request: Request) {
  const parsed = orderInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Champs invalides", issues: parsed.error.issues }, 400);
  if (parsed.data.website) return json({ error: "Requête invalide" }, 400);
  const { website: _website, ...input } = parsed.data;
  const order = await createOrder(input);
  return json(order, 201);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep orders`
Expected: no output (no type errors in this file or its imports).

- [ ] **Step 3: Manual verification (if `netlify dev` is available in your terminal)**

```bash
curl -s -X POST "http://localhost:8888/.netlify/functions/orders" -H "content-type: application/json" -d '{"requestedTruckCount":3,"truckType":"dump_truck","pickupLocation":"Bissau","dropoffLocation":"Bafatá","neededFrom":"2026-08-20","cargoDescription":"Sable","clientName":"Fatumata Camará","clientPhone":"+245955000900"}'
curl -s "http://localhost:8888/.netlify/functions/orders" -b "agrotruck_session=<admin token from the first plan's Task 5 verification>"
```

Expected: the `POST` returns `201` with the created order; the unauthenticated `GET` (no cookie) returns `403`; with the admin cookie it returns the order in a list.

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/orders.mts
git commit -m "feat: add orders Netlify Function"
```

---

## Task 3: Client order request form on `/location`

**Files:**
- Create: `components/location/order-request-form.tsx`
- Modify: `app/location/page.tsx`

**Interfaces:**
- Consumes: `POST /.netlify/functions/orders` (Task 2); `truckTypeLabels` from `types/truck.ts`; `whatsappUrl` from `lib/utils.ts`; `agroTruckWhatsapp` from `lib/contact.ts`.
- Produces: `<OrderRequestForm defaultType?: TruckType />`, read by `app/location/page.tsx`. The `type` query param already produced by `TruckContactActions`/`TruckCard`'s "Demander ce type de camion" links (`/location?type=…`, wired in the first plan's Task 12) becomes the form's pre-filled truck type.

- [ ] **Step 1: Implement `components/location/order-request-form.tsx`**

```tsx
// components/location/order-request-form.tsx
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { truckTypeLabels, type TruckType } from "@/types/truck";
import { whatsappUrl } from "@/lib/utils";
import { agroTruckWhatsapp } from "@/lib/contact";

type FormState = {
  requestedTruckCount: string; truckType: TruckType; pickupLocation: string; dropoffLocation: string;
  neededFrom: string; cargoDescription: string; clientName: string; clientPhone: string;
};

function isTruckType(value: string | null): value is TruckType {
  return Boolean(value) && value! in truckTypeLabels;
}

export function OrderRequestForm() {
  const typeParam = useSearchParams().get("type");
  const [form, setForm] = useState<FormState>({
    requestedTruckCount: "1", truckType: isTruckType(typeParam) ? typeParam : "flatbed",
    pickupLocation: "", dropoffLocation: "", neededFrom: "", cargoDescription: "", clientName: "", clientPhone: "",
  });
  const [status, setStatus] = useState<"idle" | "saving" | "sent" | "error">("idle");
  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("saving");
    const payload = {
      requestedTruckCount: Number(form.requestedTruckCount), truckType: form.truckType,
      pickupLocation: form.pickupLocation, dropoffLocation: form.dropoffLocation, neededFrom: form.neededFrom,
      cargoDescription: form.cargoDescription, clientName: form.clientName, clientPhone: form.clientPhone,
    };
    try {
      const response = await fetch("/.netlify/functions/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, website: "" }),
      });
      if (!response.ok) { setStatus("error"); return; }
      const message = [
        "Olá Badora, je souhaite louer :",
        `${payload.requestedTruckCount} camion(s) — ${truckTypeLabels[form.truckType]}`,
        `Trajet : ${payload.pickupLocation} → ${payload.dropoffLocation}`,
        `À partir du : ${payload.neededFrom}`,
        payload.cargoDescription ? `Marchandise : ${payload.cargoDescription}` : null,
        `Contact : ${payload.clientName}, ${payload.clientPhone}`,
      ].filter(Boolean).join("\n");
      window.open(whatsappUrl(agroTruckWhatsapp, message), "_blank", "noreferrer");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return <div className="rounded-[20px] border border-primary/10 bg-white p-6 text-center"><p className="font-heading text-lg font-semibold text-foreground">Demande envoyée</p><p className="mt-2 text-sm text-muted-foreground">Une fenêtre WhatsApp s'est ouverte avec votre demande pré-remplie — il ne reste qu'à l'envoyer à Badora.</p></div>;
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-[20px] border border-primary/10 bg-white p-6 shadow-[0_18px_50px_rgba(17,17,17,.06)]">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre de camions"><Input type="number" min="1" value={form.requestedTruckCount} onChange={set("requestedTruckCount")} required /></Field>
        <Field label="Type de camion">
          <select className="focus-ring h-11 w-full rounded-xl border border-primary/15 bg-white px-3 text-sm" value={form.truckType} onChange={(event) => setForm((current) => ({ ...current, truckType: event.target.value as TruckType }))}>
            {Object.entries(truckTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Départ"><Input value={form.pickupLocation} onChange={set("pickupLocation")} required /></Field>
        <Field label="Destination"><Input value={form.dropoffLocation} onChange={set("dropoffLocation")} required /></Field>
      </div>
      <Field label="Date souhaitée"><Input type="date" value={form.neededFrom} onChange={set("neededFrom")} required /></Field>
      <Field label="Marchandise transportée"><Textarea value={form.cargoDescription} onChange={set("cargoDescription")} rows={2} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Votre nom"><Input value={form.clientName} onChange={set("clientName")} required /></Field>
        <Field label="Votre téléphone"><Input value={form.clientPhone} onChange={set("clientPhone")} required /></Field>
      </div>
      {status === "error" && <p className="text-sm text-danger">La demande n&apos;a pas pu être envoyée. Réessayez.</p>}
      <Button type="submit" disabled={status === "saving"}>{status === "saving" ? "Envoi…" : "Demander sur WhatsApp"}</Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label>{label}</Label><div className="mt-1.5">{children}</div></div>; }
```

- [ ] **Step 2: Wire it into `app/location/page.tsx`**

Read the current file first (`Read app/location/page.tsx`) — it is a server component rendering `<TrucksBrowser initialTrucks={vehicles} mode="rental" />` inside a `<Suspense>`. Add the form above the browser, inside its own `<Suspense>` boundary (required because `OrderRequestForm` calls `useSearchParams()` under `output: "export"` — see the note from the first plan's Task 10):

```tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { TrucksBrowser } from "@/components/trucks/trucks-browser";
import { OrderRequestForm } from "@/components/location/order-request-form";
import { listTrucks } from "@/lib/truck-directory";

export const metadata: Metadata = { title: "Location de véhicules", description: "Trouvez des camions, voitures et engins disponibles à la location." };
export default async function RentalPage() {
  const vehicles = await listTrucks();
  return <main className="min-h-[70vh] bg-[#f8f8f5] pb-24 pt-12"><div className="page-shell">
    <p className="text-xs font-bold uppercase tracking-[.2em] text-[#b87400]">Location de véhicules</p>
    <h1 className="mt-3 max-w-3xl font-heading text-4xl font-extrabold tracking-[-.04em] md:text-6xl">Louez le véhicule adapté à votre trajet.</h1>
    <p className="mb-8 mt-4 max-w-2xl font-light leading-7 text-muted-foreground">Décrivez votre besoin, Badora s&apos;occupe du reste — sa flotte ou celle de ses partenaires.</p>
    <div className="mb-10 max-w-2xl"><Suspense fallback={<div className="h-96 animate-pulse rounded-[20px] bg-primary/5" />}><OrderRequestForm /></Suspense></div>
    <Suspense fallback={<div className="h-96 animate-pulse rounded-[20px] bg-primary/5"/>}><TrucksBrowser initialTrucks={vehicles} mode="rental"/></Suspense>
  </div></main>;
}
```

- [ ] **Step 3: Verify the build**

Run: `pnpm build`
Expected: succeeds; `/location` still lists in the route output.

- [ ] **Step 4: Commit**

```bash
git add components/location/order-request-form.tsx app/location/page.tsx
git commit -m "feat: add client order request form to /location"
```

---

## Task 4: Admin order history

**Files:**
- Create: `app/admin/orders/page.tsx`
- Modify: `app/admin/page.tsx` (add a link to the new page, next to the existing "File de validation"/"Partenaires" links)

**Interfaces:**
- Consumes: `SessionGate` (first plan); `GET /.netlify/functions/orders` (Task 2); `truckTypeLabels` from `types/truck.ts`.

- [ ] **Step 1: Implement `app/admin/orders/page.tsx`**

```tsx
// app/admin/orders/page.tsx
"use client";

import { useEffect, useState } from "react";
import { SessionGate } from "@/components/auth/session-gate";
import { truckTypeLabels, type TruckType } from "@/types/truck";
import type { Order } from "@/types/order";

function OrderHistory() {
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    fetch("/.netlify/functions/orders").then((response) => response.json()).then(setOrders);
  }, []);

  return (
    <div className="page-shell py-12">
      <h1 className="font-heading text-3xl font-bold">Demandes clients</h1>
      <div className="mt-8 grid gap-4">
        {orders?.map((order) => (
          <div key={order.id} className="rounded-2xl border border-primary/10 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{order.requestedTruckCount} camion(s) — {truckTypeLabels[order.truckType as TruckType] ?? order.truckType}</p>
              <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString("fr-FR")}</p>
            </div>
            <p className="mt-1 text-sm text-foreground/80">{order.pickupLocation} → {order.dropoffLocation} · à partir du {order.neededFrom}</p>
            {order.cargoDescription && <p className="mt-1 text-sm text-muted-foreground">{order.cargoDescription}</p>}
            <p className="mt-2 text-sm font-semibold text-primary">{order.clientName} · {order.clientPhone}</p>
          </div>
        ))}
        {orders?.length === 0 && <p className="text-sm text-muted-foreground">Aucune demande pour l&apos;instant.</p>}
      </div>
    </div>
  );
}

export default function Page() { return <SessionGate role="admin"><OrderHistory /></SessionGate>; }
```

- [ ] **Step 2: Add the nav link in `app/admin/page.tsx`**

Read the current file first (it has a `<div className="flex gap-3">` with two `<Link>`s for "File de validation" and "Partenaires"). Add a third:

```tsx
<Link href="/admin/orders" className="focus-ring text-sm font-semibold text-primary">Demandes clients</Link>
```

- [ ] **Step 3: Verify**

Run: `pnpm build && pnpm lint`
Expected: both succeed; route output includes `/admin/orders`.

- [ ] **Step 4: Commit**

```bash
git add app/admin/orders/page.tsx app/admin/page.tsx
git commit -m "feat: add admin order history page"
```

---

## Self-Review Notes

- **Spec coverage:** client request form with no price (Task 3), WhatsApp click-to-chat handoff (Task 3), order persistence for Badora's visibility (Tasks 1-2), admin order history (Task 4). Nothing in the spec's client-flow section is left unimplemented.
- **Placeholder scan:** no TBD/TODO; every step has complete, runnable code.
- **Type consistency:** `Order` (from the first plan's `types/order.ts`) is used identically across Tasks 1, 2, 4. `TruckType`/`truckTypeLabels` (from the first plan's `types/truck.ts`) are used identically in Tasks 3 and 4.
