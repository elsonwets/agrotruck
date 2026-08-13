import type { MetadataRoute } from "next";
import { listCompanies, listTrucks } from "@/lib/truck-directory";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const pages = ["", "/trucks", "/location", "/vente", "/entreprises", "/about", "/comment-ca-marche"].map((path) => ({ url: `${base}${path}`, changeFrequency: "weekly" as const, priority: path === "" ? 1 : .8 }));
  const [companies, trucks] = await Promise.all([listCompanies(), listTrucks()]);
  return [...pages, ...companies.map((company) => ({ url: `${base}/entreprises/${company.slug}`, changeFrequency: "weekly" as const, priority: .75 })), ...trucks.map((truck) => ({ url: `${base}/trucks/${truck.slug}`, changeFrequency: "weekly" as const, priority: .7 }))];
}
