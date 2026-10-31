import type { MetadataRoute } from "next";
import { serverApi } from "@/lib/api";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  let studios: any[] = [];
  try {
    studios = (await serverApi("/studios")).items;
  } catch {}
  return [
    "",
    "/studios",
    "/memberships",
    ...studios.map((s) => "/studios/" + s.slug),
  ].map((path) => ({ url: base + path }));
}
