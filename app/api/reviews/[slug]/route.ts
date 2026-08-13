import { NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";
import { z } from "zod";
import type { TruckRatings } from "@/types/truck";

export const dynamic = "force-dynamic";

const reviewSchema = z.object({
  visitorId: z.string().uuid(),
  vehicleQuality: z.number().int().min(1).max(5),
  professionalism: z.number().int().min(1).max(5),
  reliability: z.number().int().min(1).max(5),
  website: z.string().max(0).optional(),
});

type StoredReview = z.infer<typeof reviewSchema> & { createdAt: string };

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    return NextResponse.json(await aggregateReviews((await params).slug));
  } catch (error) {
    console.error("Unable to read Netlify review store", error);
    return NextResponse.json(null);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Avaliação inválida." }, { status: 400 });

  try {
    const slug = safeSlug((await params).slug);
    const store = getStore({ name: "agrotruck-reviews" });
    await store.setJSON(`${slug}/${parsed.data.visitorId}`, { ...parsed.data, createdAt: new Date().toISOString() });
    return NextResponse.json(await aggregateReviews(slug));
  } catch (error) {
    console.error("Unable to save Netlify review", error);
    return NextResponse.json({ error: "Não foi possível guardar a avaliação agora." }, { status: 503 });
  }
}

async function aggregateReviews(rawSlug: string): Promise<TruckRatings | null> {
  const slug = safeSlug(rawSlug);
  const store = getStore({ name: "agrotruck-reviews" });
  const { blobs } = await store.list({ prefix: `${slug}/` });
  const reviews = (await Promise.all(blobs.map(({ key }) => store.get(key, { type: "json", consistency: "strong" }) as Promise<StoredReview | null>))).filter((review): review is StoredReview => Boolean(review));
  if (!reviews.length) return null;

  const average = (key: "vehicleQuality" | "professionalism" | "reliability") => reviews.reduce((sum, review) => sum + review[key], 0) / reviews.length;
  const vehicleQuality = average("vehicleQuality");
  const professionalism = average("professionalism");
  const reliability = average("reliability");
  return { overall: (vehicleQuality + professionalism + reliability) / 3, vehicleQuality, professionalism, reliability, reviewCount: reviews.length };
}

function safeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 100);
}
