"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

/**
 * "Yarn divider · animated" — Figma 104:168.
 *
 * A strand of yarn that draws itself once, with a ball rolling along it, when
 * 60% of it has scrolled into view. Reduced motion: shown already drawn.
 * Decorative, so hidden from assistive technology.
 */
export function YarnDivider() {
  const box = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const node = box.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the finished picture depends on a browser-only media query
      setDrawn(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setDrawn(true);
          observer.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={box} aria-hidden className="relative h-10 w-full">
      <svg
        viewBox="0 0 1216 48"
        preserveAspectRatio="none"
        className="absolute inset-0 h-10 w-full overflow-visible"
        fill="none"
      >
        <path
          d="M0 24C100 0 200 48 300 24C400 0 500 0 590 24C593.933 25.0489 597.523 25.6165 600.751 25.8041M600.751 25.8041C622.141 27.0476 627.64 11.6067 612 9C600.442 6.83282 596.189 17.712 600.751 25.8041ZM600.751 25.8041C602.504 28.9138 605.558 31.612 610 33C700 48 800 0 900 24C1000 48 1100 48 1216 24"
          stroke="#C9B6F0"
          strokeWidth="5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          pathLength={1000}
          strokeDasharray={1000}
          strokeDashoffset={drawn ? 0 : 1000}
          style={{ transition: "stroke-dashoffset 1600ms cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </svg>

      {/* The ball rolls along as the strand unspools. */}
      <div
        className="absolute top-[3px] size-[34px]"
        style={{
          left: drawn ? "calc(100% - 20px)" : "-14px",
          transform: `rotate(${drawn ? 720 : 0}deg)`,
          transition:
            "left 1600ms cubic-bezier(0.4, 0, 0.2, 1), transform 1600ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <Image
          src="/home/plum/yarn-ball.svg"
          alt=""
          width={92}
          height={95}
          unoptimized
          className="size-full max-w-none"
        />
      </div>
    </div>
  );
}
