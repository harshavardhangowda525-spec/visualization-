import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  if (process.env.DEPLOYMENT_ENV === "preview") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/staff", "/dashboard", "/login", "/api"],
    },
    sitemap:
      (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000") +
      "/sitemap.xml",
  };
}
