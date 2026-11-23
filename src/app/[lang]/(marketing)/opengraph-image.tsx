import { ImageResponse } from "next/og";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { loadMessages } from "@/i18n/messages";
import { SITE_NAME } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = SITE_NAME;

/** Share image of the public pages, in the page's language: the mark, the name, the promise. */
// An image route is a route handler, where next/root-params is not available yet: use params.
export default async function OpenGraphImage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const t = await loadMessages(isLocale(lang) ? lang : DEFAULT_LOCALE);
  const ink = "#1c1917";
  const u = 6; // one unit of the 48-unit mark → a 288 px mark
  const box = (x: number, y: number, w: number, h: number, color: string) => ({
    position: "absolute" as const,
    left: x * u,
    top: y * u,
    width: w * u,
    height: h * u,
    background: color,
  });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 72, padding: 96, background: "#fafaf9", color: ink }}>
        <div style={{ position: "relative", width: 48 * u, height: 48 * u, display: "flex", flexShrink: 0 }}>
          <div style={box(10.5, 10.5, 27, 27, ink)} />
          <div style={box(14.36, 14.36, 19.28, 19.28, "#fafaf9")} />
          <div style={box(18.21, 18.21, 11.58, 11.58, "#0f766e")} />
          <div style={box(3, 3, 8, 2.5, ink)} />
          <div style={box(3, 3, 2.5, 8, ink)} />
          <div style={box(37, 3, 8, 2.5, ink)} />
          <div style={box(42.5, 3, 2.5, 8, ink)} />
          <div style={box(3, 42.5, 8, 2.5, ink)} />
          <div style={box(3, 37, 2.5, 8, ink)} />
          <div style={box(37, 42.5, 8, 2.5, ink)} />
          <div style={box(42.5, 37, 2.5, 8, ink)} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -3 }}>{SITE_NAME}</div>
          <div style={{ fontSize: 40, color: "#57534e", lineHeight: 1.25 }}>{t.home.title}</div>
          <div style={{ fontSize: 28, color: "#0f766e" }}>{t.footer.staticForever}</div>
        </div>
      </div>
    ),
    size,
  );
}
