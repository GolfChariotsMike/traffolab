import type { MetadataRoute } from "next";
import { absoluteUrl, sitemapPaths } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapPaths.map((path) => ({
    url: absoluteUrl(path),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" || path === "/traffolyte-labels-perth/" ? 1 : 0.7,
  }));
}
