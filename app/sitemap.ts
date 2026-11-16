import type { MetadataRoute } from "next";
import { absoluteUrl, sitemapPaths } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return sitemapPaths.map((path) => ({
    url: absoluteUrl(path),
    lastModified,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" || path === "/traffolyte-labels-perth/" ? 1 : 0.7,
  }));
}
