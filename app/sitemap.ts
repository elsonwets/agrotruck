import type { MetadataRoute } from "next";
import { trucks } from "@/data/trucks";
import { groupTrucksByCompany } from "@/lib/companies";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const pages = ["", "/entreprises", "/pricing", "/about", "/devenir-partenaire", "/comment-ca-marche"].map((path) => ({ url: `${base}${path}`, changeFrequency: "weekly" as const, priority: path === "" ? 1 : .8 }));
  const companies = groupTrucksByCompany(trucks);
  return [...pages, ...companies.map((company) => ({ url: `${base}/entreprises/${company.slug}`, changeFrequency: "weekly" as const, priority: .75 })), ...trucks.map((truck) => ({ url: `${base}/trucks/${truck.slug}`, changeFrequency: "weekly" as const, priority: .7 }))];
}
