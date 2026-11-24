import type { ReactNode } from "react";
import type { QrEyeBall, QrEyeFrame, QrFrame, QrModule } from "@/lib/qr/types";

// Thumbnails: a few modules or one eye in the shape, drawn in the text color.

const THUMB = "size-8";
/** A 4x4 corner of a code: which cells are dark. */
const SAMPLE = ["1101", "0111", "1010", "1110"];

export function ModuleThumb({ shape }: { shape: QrModule }) {
  const cells: ReactNode[] = [];
  SAMPLE.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c !== "1") return;
      const key = `${x}-${y}`;
      if (shape === "dots") cells.push(<circle key={key} cx={x + 0.5} cy={y + 0.5} r={0.42} />);
      else if (shape === "rounded") cells.push(<rect key={key} x={x + 0.04} y={y + 0.04} width={0.92} height={0.92} rx={0.35} />);
      else if (shape === "bars") cells.push(<rect key={key} x={x + 0.12} y={y} width={0.76} height={1} rx={0.38} />);
      else if (shape === "hbars") cells.push(<rect key={key} x={x} y={y + 0.12} width={1} height={0.76} rx={0.38} />);
      else if (shape === "small") cells.push(<rect key={key} x={x + 0.12} y={y + 0.12} width={0.76} height={0.76} />);
      else if (shape === "diamond") cells.push(<path key={key} d={`M${x + 0.5} ${y}l0.5 0.5-0.5 0.5-0.5-0.5Z`} />);
      else cells.push(<rect key={key} x={x} y={y} width={1} height={1} />);
    }),
  );
  return (
    <svg viewBox="-0.5 -0.5 5 5" className={THUMB} fill="currentColor">
      {cells}
    </svg>
  );
}

/** A square path with per-corner radii (top-left, top-right, bottom-right, bottom-left). */
function box(x: number, y: number, s: number, [a, b, c, d]: readonly number[]): string {
  return (
    `M${x + a} ${y}H${x + s - b}` +
    (b ? `A${b} ${b} 0 0 1 ${x + s} ${y + b}` : "") +
    `V${y + s - c}` +
    (c ? `A${c} ${c} 0 0 1 ${x + s - c} ${y + s}` : "") +
    `H${x + d}` +
    (d ? `A${d} ${d} 0 0 1 ${x} ${y + s - d}` : "") +
    `V${y + a}` +
    (a ? `A${a} ${a} 0 0 1 ${x + a} ${y}` : "") +
    "Z"
  );
}

// The API's radii (backend internal/qr/geometry.go), as drawn for the top-left eye.
const RING: Record<QrEyeFrame, [number[], number[]]> = {
  square: [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  rounded: [
    [2, 2, 2, 2],
    [1.2, 1.2, 1.2, 1.2],
  ],
  "extra-rounded": [
    [2.9, 2.9, 2.9, 2.9],
    [2, 2, 2, 2],
  ],
  circle: [
    [3.5, 3.5, 3.5, 3.5],
    [2.5, 2.5, 2.5, 2.5],
  ],
  leaf: [
    [3, 0, 3, 0],
    [2, 0, 2, 0],
  ],
  pointed: [
    [3, 3, 0, 3],
    [2, 2, 0, 2],
  ],
};
const BALL: Record<Exclude<QrEyeBall, "diamond">, number[]> = {
  square: [0, 0, 0, 0],
  rounded: [0.9, 0.9, 0.9, 0.9],
  circle: [1.5, 1.5, 1.5, 1.5],
  leaf: [1.3, 0, 1.3, 0],
  pointed: [1.3, 1.3, 0, 1.3],
};

export function EyeFrameThumb({ shape }: { shape: QrEyeFrame }) {
  const [ring, hole] = RING[shape];
  return (
    <svg viewBox="-0.5 -0.5 8 8" className={THUMB} fill="currentColor" fillRule="evenodd">
      <path d={box(0, 0, 7, ring) + box(1, 1, 5, hole)} />
      <rect x="2" y="2" width="3" height="3" opacity="0.3" />
    </svg>
  );
}

export function EyeBallThumb({ shape }: { shape: QrEyeBall }) {
  return (
    <svg viewBox="-0.5 -0.5 8 8" className={THUMB} fill="currentColor" fillRule="evenodd">
      <path d={box(0, 0, 7, [0, 0, 0, 0]) + box(1, 1, 5, [0, 0, 0, 0])} opacity="0.3" />
      {shape === "diamond" ? <path d="M3.5 1.55L5.45 3.5 3.5 5.45 1.55 3.5Z" /> : <path d={box(2, 2, 3, BALL[shape])} />}
    </svg>
  );
}

/** Small drawings of the decorative frames (16x16, the code as a 5x5 block). */
const DECOR: Partial<Record<QrFrame, ReactNode>> = {
  "bubble-top": (
    <>
      <rect x="1" y="0.5" width="14" height="4" rx="1.2" />
      <path d="M7 4.4h2L8 5.8Z" />
      <rect x="5" y="7.5" width="6" height="6" rx="0.6" opacity="0.55" />
    </>
  ),
  "bubble-bottom": (
    <>
      <rect x="5" y="1.5" width="6" height="6" rx="0.6" opacity="0.55" />
      <path d="M7 11.6h2L8 10.2Z" />
      <rect x="1" y="11.5" width="14" height="4" rx="1.2" />
    </>
  ),
  ribbon: (
    <>
      <rect x="3.5" y="0.5" width="9" height="9" rx="1" fill="none" stroke="currentColor" />
      <rect x="5.5" y="2.5" width="5" height="5" opacity="0.55" />
      <rect x="2.5" y="11" width="11" height="3.2" rx="0.3" />
      <path d="M2 12h-1.8l0.8 1.4-0.8 1.4H2ZM14 12h1.8l-0.8 1.4 0.8 1.4H14Z" />
    </>
  ),
  phone: (
    <>
      <path fillRule="evenodd" d="M4.5 0.5h7a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 14V2A1.5 1.5 0 0 1 4.5 0.5ZM4.3 2.2v8.6h7.4V2.2Z" />
      <rect x="5.5" y="3.5" width="5" height="5" opacity="0.55" />
    </>
  ),
  bag: (
    <>
      <path d="M5.5 4.6C5.5 1.6 10.5 1.6 10.5 4.6" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <path fillRule="evenodd" d="M2.5 4.5h11v10.3a0.7 0.7 0 0 1-0.7 0.7H3.2a0.7 0.7 0 0 1-0.7-0.7ZM3.8 5.8v6.4h8.4V5.8Z" />
      <rect x="5.5" y="6.5" width="5" height="5" opacity="0.55" />
    </>
  ),
  cup: (
    <>
      <path d="M4 1.2c0.6 0.8-0.6 1.4 0 2.2M6.5 1.2c0.6 0.8-0.6 1.4 0 2.2M9 1.2c0.6 0.8-0.6 1.4 0 2.2" fill="none" stroke="currentColor" strokeWidth="0.6" />
      <circle cx="13" cy="9" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <path fillRule="evenodd" d="M1.5 4.5h11.5v8.5a2.5 2.5 0 0 1-2.5 2.5H4a2.5 2.5 0 0 1-2.5-2.5ZM2.7 5.7v6.3h9.1V5.7Z" />
      <rect x="4.7" y="6.3" width="5" height="5" opacity="0.55" />
    </>
  ),
  arrow: (
    <>
      <rect x="6" y="1" width="8" height="8" opacity="0.55" />
      <path d="M6.5 13C2 13.4 2 9.5 3 7.6" fill="none" stroke="currentColor" strokeWidth="0.9" />
      <path d="M1.7 8.2l1.6-2.2 1 2.4Z" />
      <rect x="7" y="12" width="7" height="1.6" rx="0.8" />
    </>
  ),
  beer: (
    <>
      <path d="M1.5 4.2a1.1 1.1 0 0 1 2-.6 1.1 1.1 0 0 1 2 0 1.1 1.1 0 0 1 2 0 1.1 1.1 0 0 1 2 0 1.1 1.1 0 0 1 2 0 1.1 1.1 0 0 1 2 .6Z" />
      <path fillRule="evenodd" d="M1.5 4.2h11.5v10.6a.7.7 0 0 1-.7.7H2.2a.7.7 0 0 1-.7-.7ZM2.7 5.4v6.8h9.1V5.4Z" />
      <rect x="13" y="6.5" width="2.5" height="4.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />
      <rect x="4.7" y="6.3" width="5" height="5" opacity="0.55" />
    </>
  ),
  chef: (
    <>
      <circle cx="5.6" cy="3" r="1.8" />
      <circle cx="8" cy="2.3" r="2" />
      <circle cx="10.4" cy="3" r="1.8" />
      <rect x="5" y="3.3" width="6" height="2" />
      <path fillRule="evenodd" d="M3 5.3h10a.8.8 0 0 1 .8.8v9.1a.8.8 0 0 1-.8.8H3a.8.8 0 0 1-.8-.8V6.1a.8.8 0 0 1 .8-.8ZM3.5 6.3v6.6h9V6.3Z" />
      <rect x="5.5" y="7.1" width="5" height="5" opacity="0.55" />
    </>
  ),
  cloche: (
    <>
      <circle cx="8" cy="1.3" r=".7" />
      <path d="M4.5 4.6a3.5 3.1 0 0 1 7 0Z" />
      <rect x="3.6" y="4.6" width="8.8" height=".7" rx=".35" />
      <path fillRule="evenodd" d="M3 5.8h10a.8.8 0 0 1 .8.8v8.6a.8.8 0 0 1-.8.8H3a.8.8 0 0 1-.8-.8V6.6a.8.8 0 0 1 .8-.8ZM3.5 6.8v6.1h9V6.8Z" />
      <rect x="5.5" y="7.4" width="5" height="5" opacity="0.55" />
    </>
  ),
  takeaway: (
    <>
      <rect x="1.4" y="1" width="13.2" height="1.6" rx=".6" />
      <path fillRule="evenodd" d="M1.6 3.1h12.8l-1.7 12.4H3.3ZM4.2 4.4v6.6h7.6V4.4Z" />
      <rect x="5.5" y="5.2" width="5" height="5" opacity="0.55" />
    </>
  ),
  menu: (
    <>
      <path d="M11.2 0h1.4v2.4l-.7-.6-.7.6Z" />
      <path fillRule="evenodd" d="M2.4 1.4h11a.9.9 0 0 1 .9.9v12.4a.9.9 0 0 1-.9.9h-11a.6.6 0 0 1-.6-.6V2a.6.6 0 0 1 .6-.6ZM5 3v8.8h8V3ZM3.6 2.4v12h.3v-12Z" />
      <rect x="6.5" y="4.6" width="5" height="5" opacity="0.55" />
    </>
  ),
  receipt: (
    <>
      <path fillRule="evenodd" d="M2 1l1.2.8L4.4 1l1.2.8L6.8 1 8 1.8 9.2 1l1.2.8 1.2-.8 1.2.8L14 1v14l-1.2-.8-1.2.8-1.2-.8-1.2.8L8 14.2l-1.2.8-1.2-.8-1.2.8-1.2-.8L2 15ZM3.6 3.2v8.2h8.8V3.2Z" />
      <rect x="5.5" y="4.8" width="5" height="5" opacity="0.55" />
    </>
  ),
  corners: (
    <>
      <path d="M1 4V1h3M12 1h3v3M15 9v3h-3M4 12H1V9" fill="none" stroke="currentColor" strokeWidth="1" />
      <rect x="4" y="3" width="8" height="6" opacity="0.55" />
      <rect x="4" y="13.5" width="8" height="1.6" rx="0.8" />
    </>
  ),
};

export function FrameThumb({ frame }: { frame: QrFrame }) {
  const decor = DECOR[frame];
  if (decor) {
    return (
      <svg viewBox="0 0 16 16" className={THUMB} fill="currentColor">
        {decor}
      </svg>
    );
  }
  const code = (y: number) => (
    <g transform={`translate(4.5 ${y})`}>
      <rect width="3" height="3" />
      <rect x="4" width="3" height="3" />
      <rect y="4" width="3" height="3" />
      <rect x="4.5" y="4.5" width="2" height="2" />
    </g>
  );
  if (frame === "none") {
    return (
      <svg viewBox="0 0 16 16" className={THUMB} fill="currentColor">
        {code(4.5)}
      </svg>
    );
  }
  if (frame === "box") {
    return (
      <svg viewBox="0 0 16 16" className={THUMB} fill="currentColor">
        <rect x="2.5" y="0.5" width="11" height="11" rx="1.2" fill="none" stroke="currentColor" />
        <g transform="translate(-1.5 -1.5)">{code(3.5)}</g>
        <rect x="4" y="13" width="8" height="1.6" rx="0.8" />
      </svg>
    );
  }
  const top = frame === "label-top";
  return (
    <svg viewBox="0 0 16 16" className={THUMB} fill="currentColor" fillRule="evenodd">
      <path d={`M3 0h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V1a1 1 0 0 1 1-1Z${top ? "M3 4.5h10v10.5H3Z" : "M3 1h10v10.5H3Z"}`} />
      <g transform={`translate(-0.5 ${top ? 1 : -2.5})`}>{code(4.5)}</g>
    </svg>
  );
}
