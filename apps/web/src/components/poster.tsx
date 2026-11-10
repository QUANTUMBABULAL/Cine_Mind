"use client";

import { useState } from "react";

const ASPECT = {
  poster: "aspect-[2/3]",
  portrait: "aspect-[3/4]",
  square: "aspect-square",
  wide: "aspect-[16/7]",
};

// Shows an image when a URL exists and loads; otherwise a styled placeholder
// with initials, so a missing or broken image never breaks the layout.
export function Poster({
  src,
  label,
  sub,
  ratio = "poster",
  rounded = "rounded-lg",
  zoom = false,
  initialsClass = "text-3xl",
}: {
  src: string | null | undefined;
  label: string;
  sub?: string;
  ratio?: keyof typeof ASPECT;
  rounded?: string;
  /** Slight zoom on hover of the closest `.group` parent. */
  zoom?: boolean;
  /** Size of the placeholder initials (smaller for avatars). */
  initialsClass?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = label
    .split(/\s+/)
    .filter((w) => /^[A-Z0-9]/.test(w)) // skip "of", "the", punctuation
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  return (
    <div className={`${ASPECT[ratio]} relative w-full overflow-hidden ${rounded} bg-panel-2`}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={label}
          loading="lazy"
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover ${ratio === "poster" ? "object-center" : "object-top"} ${
            zoom ? "transition duration-300 group-hover:scale-105" : ""
          }`}
        />
      ) : (
        <div
          role="img"
          aria-label={label}
          className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-accent/30 via-panel-2 to-coral/20"
        >
          <span className={`heading text-ivory/90 ${initialsClass}`}>{initials || "?"}</span>
          {sub && ratio !== "square" && (
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted">{sub}</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Full-width banner: the image blurred as a backdrop, so small posters still fill it cleanly. */
export function Backdrop({ src, children }: { src: string | null; children: React.ReactNode }) {
  return (
    <section className="relative mb-10 overflow-hidden rounded-2xl bg-panel">
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/40" />
      <div className="relative">{children}</div>
    </section>
  );
}
