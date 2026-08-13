import { getStore } from "@netlify/blobs";

type Scores = { vehicleQuality: number; professionalism: number; reliability: number };
type StoredReview = Scores & { visitorId: string; updatedAt: string };

const handler = async (request: Request) => {
  const url = new URL(request.url);
  const pathSlug = url.pathname.split("/").filter(Boolean).at(-1);
  const slug = clean(url.searchParams.get("slug") ?? (pathSlug === "reviews" ? null : pathSlug ?? null));
  if (!slug) return json({ error: "Annonce invalide" }, 400);
  if (request.method === "GET") return json(await aggregate(slug));
  if (request.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    const body = await request.json() as Partial<StoredReview> & { website?: string };
    if (body.website) return json({ error: "Requête invalide" }, 400);
    const visitorId = typeof body.visitorId === "string" ? body.visitorId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 80) : "";
    const scores = { vehicleQuality: score(body.vehicleQuality), professionalism: score(body.professionalism), reliability: score(body.reliability) };
    if (!visitorId || Object.values(scores).some((value) => !value)) return json({ error: "Évaluation incomplète" }, 400);
    await getStore("agrotruck-reviews").setJSON(`${slug}/${visitorId}`, { visitorId, ...scores, updatedAt: new Date().toISOString() });
    return json(await aggregate(slug));
  } catch { return json({ error: "Requête invalide" }, 400); }
};

export default handler;

async function aggregate(slug: string) {
  const store = getStore("agrotruck-reviews");
  const { blobs } = await store.list({ prefix: `${slug}/` });
  const reviews = (await Promise.all(blobs.map(({ key }) => store.get(key, { type: "json", consistency: "strong" }) as Promise<StoredReview | null>))).filter((review): review is StoredReview => Boolean(review));
  if (!reviews.length) return null;
  const average = (key: keyof Scores) => reviews.reduce((total, review) => total + review[key], 0) / reviews.length;
  const vehicleQuality = average("vehicleQuality"), professionalism = average("professionalism"), reliability = average("reliability");
  return { overall: (vehicleQuality + professionalism + reliability) / 3, vehicleQuality, professionalism, reliability, reviewCount: reviews.length };
}

function clean(value: string | null) { return value?.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 100) ?? ""; }
function score(value: unknown) { return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5 ? value : 0; }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }); }
