import type { MetadataRoute } from "next";
import { trucks } from "@/data/trucks";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const pages = ["", "/about", "/devenir-partenaire", "/comment-ca-marche"].map((path) => ({ url: `${base}${path}`, changeFrequency: "weekly" as const, priority: path === "" ? 1 : .8 }));
  return [...pages, ...trucks.map((truck) => ({ url: `${base}/trucks/${truck.slug}`, changeFrequency: "weekly" as const, priority: .7 }))];
}
