import { cx } from "@/components/ui";

// Built-in avatars for testimonials without a photo: friendly line-art faces.
export const FACES = ["sunglasses", "smile", "wink", "grin", "hearts", "laugh", "starry", "calm"] as const;
export type Face = (typeof FACES)[number];

const COLORS: Record<Face, string> = {
  sunglasses: "#f2d43d",
  smile: "#f59e42",
  wink: "#4f8df5",
  grin: "#ec5f9a",
  hearts: "#ef4f5c",
  laugh: "#34b27b",
  starry: "#8b5cf6",
  calm: "#14b8a6",
};

export function randomFace(exclude?: string): Face {
  const options = FACES.filter((f) => f !== exclude);
  return options[Math.floor(Math.random() * options.length)];
}

export function isFace(value: string | null | undefined): value is Face {
  return FACES.includes(value as Face);
}

function Features({ face, c }: { face: Face; c: string }) {
  const s = { stroke: c, strokeWidth: 3.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  switch (face) {
    case "sunglasses":
      return (
        <>
          <path d="M10 25h44" {...s} />
          <path d="M13 25c0 7 3 10 8 10s8-4 8-10M35 25c0 7 3 10 8 10s8-4 8-10" fill={c} stroke={c} strokeWidth={2} />
          <path d="M24 46c5 4 11 4 16 0" {...s} />
        </>
      );
    case "smile":
      return (
        <>
          <circle cx="23" cy="27" r="2.6" fill={c} />
          <circle cx="41" cy="27" r="2.6" fill={c} />
          <path d="M21 40c6 7 16 7 22 0" {...s} />
        </>
      );
    case "wink":
      return (
        <>
          <circle cx="23" cy="27" r="2.6" fill={c} />
          <path d="M37 27h8" {...s} />
          <path d="M22 41c5 6 15 6 20 0" {...s} />
        </>
      );
    case "grin":
      return (
        <>
          <path d="M19 27c2-3 6-3 8 0M37 27c2-3 6-3 8 0" {...s} />
          <path d="M19 37h26c0 8-6 12-13 12s-13-4-13-12z" fill={c} stroke={c} strokeWidth={2} strokeLinejoin="round" />
        </>
      );
    case "hearts":
      return (
        <>
          <path d="M23 31s-6-4-6-8a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 4-6 8-6 8zM41 31s-6-4-6-8a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 4-6 8-6 8z" fill={c} />
          <path d="M22 41c5 6 15 6 20 0" {...s} />
        </>
      );
    case "laugh":
      return (
        <>
          <path d="M18 28l5-3 5 3M36 28l5-3 5 3" {...s} />
          <path d="M20 38h24c-1 7-6 11-12 11s-11-4-12-11z" fill={c} stroke={c} strokeWidth={2} strokeLinejoin="round" />
        </>
      );
    case "starry":
      return (
        <>
          <path d="M23 21l1.8 4 4.2.4-3.2 2.8 1 4.2-3.8-2.3-3.8 2.3 1-4.2-3.2-2.8 4.2-.4zM41 21l1.8 4 4.2.4-3.2 2.8 1 4.2-3.8-2.3-3.8 2.3 1-4.2-3.2-2.8 4.2-.4z" fill={c} />
          <path d="M24 42c5 5 11 5 16 0" {...s} />
        </>
      );
    case "calm":
      return (
        <>
          <path d="M18 28c2 3 7 3 9 0M37 28c2 3 7 3 9 0" {...s} />
          <path d="M25 42c4 3 10 3 14 0" {...s} />
        </>
      );
  }
}

export function FaceAvatar({ face, url, size = 40, className }: { face?: string | null; url?: string | null; size?: number; className?: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" width={size} height={size} className={cx("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />
    );
  }
  const f: Face = isFace(face) ? face : "sunglasses";
  const c = COLORS[f];
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={cx("shrink-0", className)} aria-hidden>
      <circle cx="32" cy="32" r="29" fill="#ffffff" stroke={c} strokeWidth={3.2} />
      <Features face={f} c={c} />
    </svg>
  );
}
