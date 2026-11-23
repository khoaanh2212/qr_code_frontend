import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the ProofQR mark on paper, drawn with boxes (ImageResponse has no SVG paths). */
export default function AppleIcon() {
  const ink = "#1c1917";
  const u = 180 / 48; // one unit of the 48-unit mark
  const mark = (x: number, y: number, w: number, h: number, color: string) => ({
    position: "absolute" as const,
    left: x * u,
    top: y * u,
    width: w * u,
    height: h * u,
    background: color,
  });
  const crop = 7;
  const t = 3;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#fafaf9" }}>
        <div style={mark(10.5, 10.5, 27, 27, ink)} />
        <div style={mark(14.36, 14.36, 19.28, 19.28, "#fafaf9")} />
        <div style={mark(18.21, 18.21, 11.58, 11.58, "#0f766e")} />
        {/* Crop marks: two bars per corner. */}
        <div style={mark(4, 4, crop, t, ink)} />
        <div style={mark(4, 4, t, crop, ink)} />
        <div style={mark(44 - crop, 4, crop, t, ink)} />
        <div style={mark(44 - t, 4, t, crop, ink)} />
        <div style={mark(4, 44 - t, crop, t, ink)} />
        <div style={mark(4, 44 - crop, t, crop, ink)} />
        <div style={mark(44 - crop, 44 - t, crop, t, ink)} />
        <div style={mark(44 - t, 44 - crop, t, crop, ink)} />
      </div>
    ),
    size,
  );
}
