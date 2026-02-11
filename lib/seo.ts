/**
 * Central SEO configuration for شفاف (Shafaf).
 * Use NEXT_PUBLIC_SITE_URL in .env for production (e.g. https://shafaf.example.com).
 */

export const SITE_NAME = "شفاف | Shafaf";
export const SITE_DESCRIPTION =
  "سیستم مدیریت مالی شفاف - مدیریت اجناس، خریداری، فروشات، مشتریان، مصارف، کارمندان و گزارش‌های مالی";
export const SITE_KEYWORDS = [
  "شفاف",
  "Shafaf",
  "مدیریت مالی",
  "نرم‌افزار حسابداری",
  "مدیریت فروش",
  "مدیریت خرید",
  "گزارش مالی",
  "financial management",
  "inventory",
  "invoicing",
];

export const DEFAULT_OG_IMAGE_PATH = "/og.png"; // Add a 1200x630 image to public/ for social previews

/** Base URL for canonical links and Open Graph. Set in .env as NEXT_PUBLIC_SITE_URL */
export function getBaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000";
  return url.replace(/\/$/, "");
}

export function getCanonicalUrl(path: string = ""): string {
  const base = getBaseUrl().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
