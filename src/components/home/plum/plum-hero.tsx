"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { plumButtonClass } from "@/components/ui/plum-button";
import { formatMoney } from "@/lib/money";
import { useAskMeemi } from "@/lib/stores/ask-meemi";
import { cn } from "@/lib/utils";

/**
 * Home hero — Figma "Home hero" (89:2959), "Meemi makes it".
 *
 * Meemi, the mascot, offers to make something; picking a chip has her crochet it
 * and hand over a product card. The design uses three sample products (fox,
 * bear, whale). Here the chips and the card are the shop's own newest products,
 * with their real photographs, names and prices, and the card is a real link to
 * the product page. With no products the picker and card are simply not drawn.
 *
 * States, as in the design: Hello, Making, Done (then a gentle idle bob), and an
 * "excited" hop while a call to action is hovered or focused. Making is ignored
 * while Meemi is busy. Two deliberate differences:
 *
 *   - the design returns to Hello 3.3 s after Done. Here the finished card
 *     stays, so the product link is still there when the shopper reaches for
 *     it; picking another chip restarts the make.
 *   - the design's second button is "Get a free pattern" → `/free`. There is no
 *     free pattern and no such route, so it is "Free guides" → `/learn`, which
 *     is free, real, and what "Free? I love free!" is now about.
 *
 * `prefers-reduced-motion`: no movement. The first product's Done state is shown
 * straight away, the bubble text still updates, and poses swap instantly.
 */

export type HeroProduct = {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  imageUrl: string | null;
  imageAlt: string;
  categoryName: string;
};

type Phase = "hello" | "making" | "done";
type Hover = "shop" | "free" | null;

/** "No-Sew Succulent Crochet Pattern" → "No-Sew Succulent". For a chip. */
function shortName(name: string): string {
  const base = name.split(/\s[—–-]\s/)[0];
  const trimmed = base
    .replace(/\b(crochet|pattern|pdf|digital|amigurumi)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const result = trimmed.length >= 3 ? trimmed : base;
  return result.length > 24 ? `${result.slice(0, 23).trimEnd()}…` : result;
}

const STAGE = { w: 560, h: 500 } as const;

export function PlumHero({
  products,
  askMeemi = false,
}: {
  products: HeroProduct[];
  /**
   * Ask Meemi is available: the "What should Meemi make?" chips then open her
   * panel and ask for that pattern, instead of playing the make animation.
   */
  askMeemi?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("hello");
  const [picked, setPicked] = useState<number | null>(null);
  const [run, setRun] = useState(0);
  const [hover, setHover] = useState<Hover>(null);
  const [reduced, setReduced] = useState(false);
  const [scale, setScale] = useState(1);
  const touched = useRef(false);
  const timers = useRef<number[]>([]);
  const stageBox = useRef<HTMLDivElement>(null);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  const make = useCallback(
    (index: number) => {
      clearTimers();
      setPicked(index);
      setRun((value) => value + 1);
      if (reduced) {
        setPhase("done");
        return;
      }
      setPhase("making");
      timers.current.push(window.setTimeout(() => setPhase("done"), 1250));
    },
    [clearTimers, reduced],
  );

  // Reduced motion decides the first picture, so it is read before anything runs.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  // On load: Hello for 1.4 s, then make the first product once. Under reduced
  // motion the finished card is shown immediately. Never after the shopper has
  // picked something themselves.
  useEffect(() => {
    if (products.length === 0) return;
    if (reduced) {
      if (!touched.current) make(0);
      return;
    }
    const id = window.setTimeout(() => {
      if (!touched.current) make(0);
    }, 1400);
    return () => window.clearTimeout(id);
  }, [products.length, reduced, make]);

  useEffect(() => clearTimers, [clearTimers]);

  // The stage is drawn on a 560 × 500 board and scaled to the width it is given.
  useLayoutEffect(() => {
    const node = stageBox.current;
    if (!node) return;
    const measure = () => setScale(Math.min(1, node.clientWidth / STAGE.w));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const product = picked !== null ? products[picked] : undefined;
  const excited = hover !== null && phase !== "making";

  const line =
    phase === "making" && product
      ? `Ooh, ${shortName(product.name)}!`
      : excited
        ? hover === "shop"
          ? "Yay! Let’s go shopping!"
          : "Free? I love free!"
        : phase === "done"
          ? "Ta-da! Here’s your pattern."
          : "Hi! What should we make?";

  const pose = phase === "making" ? "hook" : phase === "done" ? "celebrate" : "hello";

  function pick(index: number) {
    touched.current = true;
    make(index);
  }

  const cta = (which: "shop" | "free") => ({
    onMouseEnter: () => setHover(which),
    onMouseLeave: () => setHover(null),
    onFocus: () => setHover(which),
    onBlur: () => setHover(null),
  });

  return (
    <section aria-labelledby="home-hero-title" className="bg-pl-tint-crochet">
      <div className="mx-auto grid w-full max-w-[1280px] items-center gap-x-8 gap-y-6 px-4 pt-10 pb-8 sm:px-8 lg:min-h-[600px] lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:px-12 lg:py-0">
        {/* ── Copy ─────────────────────────────────────────────────────────── */}
        <div className="font-figtree flex flex-col items-start gap-6">
          <h1
            id="home-hero-title"
            className="pl-display text-[56px] leading-[54px] tracking-[-0.035em] sm:text-[68px] sm:leading-[64px] lg:text-[80px] lg:leading-[76px]"
          >
            Make something
            <span className="mt-0 flex items-start gap-3 sm:gap-5">
              <span className="relative inline-block pb-1">
                cute
                {/* Decorative: draws in on load (stroke-dashoffset 300 → 0). */}
                <svg
                  aria-hidden
                  viewBox="0 0 240 24"
                  className="pointer-events-none absolute -bottom-3 left-0 h-[17px] w-[113px] overflow-visible sm:h-[22px] sm:w-[158px]"
                  preserveAspectRatio="none"
                  fill="none"
                >
                  <path
                    className="pl-underline-path"
                    d="M4 14C60 4 140 20 236 8"
                    stroke="#F5B02E"
                    strokeWidth="7"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span>today.</span>
            </span>
          </h1>

          <p className="max-w-[420px] text-[17px] leading-[26px] text-pl-muted sm:text-[19px] sm:leading-[28px]">
            Easy crochet patterns and digital tools, made with Meemi.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/shop"
              className={plumButtonClass({ style: "primary", size: "lg" })}
              {...cta("shop")}
            >
              Shop patterns
              <ArrowRight className="size-5" aria-hidden />
            </Link>
            <Link
              href="/learn"
              className={plumButtonClass({ style: "secondary", size: "lg" })}
              {...cta("free")}
            >
              Free guides
            </Link>
          </div>

          <p className="flex flex-wrap gap-x-[18px] gap-y-1 text-sm leading-[22px] text-pl-muted">
            <span>
              <span aria-hidden>↓ </span> Instant download
            </span>
            <span>
              <span aria-hidden>∞ </span> Download again any time
            </span>
          </p>
        </div>

        {/* ── Stage + picker ───────────────────────────────────────────────── */}
        <div className="font-figtree flex flex-col items-stretch gap-3 lg:pt-4 lg:pb-5">
          <div ref={stageBox} className="w-full max-w-[560px] self-center lg:self-auto">
            <div className="relative" style={{ height: STAGE.h * scale }}>
              <div
                // Decorative scene. Only the bubble is announced (below).
                aria-hidden
                className="absolute top-0 left-0 origin-top-left"
                style={{ width: STAGE.w, height: STAGE.h, transform: `scale(${scale})` }}
              >
                {/* Blob */}
                <Image
                  src="/home/plum/blob.svg"
                  alt=""
                  width={470}
                  height={400}
                  unoptimized
                  className="absolute top-[80px] left-[20px] h-[400px] w-[470px] max-w-none"
                />

                {/* Yarn thread, drawn in when Meemi starts making. */}
                {phase !== "hello" && (
                  <svg
                    key={`thread-${run}`}
                    viewBox={`0 0 ${STAGE.w} ${STAGE.h}`}
                    className="absolute inset-0"
                    fill="none"
                  >
                    <path
                      className="pl-thread"
                      d="M462 404C530 330 452 270 360 238"
                      stroke="#8D6BD9"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                  </svg>
                )}

                {/* Yarn ball: rolls −200° while Meemi works. */}
                <div className="absolute top-[352px] left-[392px] size-[150px]">
                  <div
                    key={`ball-${phase === "hello" ? 0 : run}`}
                    className={cn("absolute inset-0", phase !== "hello" && "pl-ball-spin")}
                  >
                    <Image
                      src="/home/plum/yarn-ball.svg"
                      alt=""
                      width={92}
                      height={95}
                      unoptimized
                      className="absolute inset-[11.67%_12.91%_11.67%_12.83%] h-auto w-auto max-w-none"
                      style={{ width: "74.26%", height: "76.66%" }}
                    />
                  </div>
                </div>

                {/* Meemi: three stacked poses, cross-faded so a swap never shows
                    through to the blob. Wiggles while making, bobs when done,
                    hops while a button is hovered. */}
                <div
                  className={cn(
                    "absolute top-[100px] left-[64.75px] size-[360px]",
                    // Two identical keyframes, alternated, restart the wiggle on a
                    // re-pick without remounting the poses (which would lose the fade).
                    phase === "making" && (run % 2 ? "pl-wiggle" : "pl-wiggle-b"),
                    phase === "done" && !excited && "pl-bob",
                    excited && "pl-hop",
                  )}
                >
                  {(
                    [
                      ["hello", "/home/plum/meemi-hello.svg"],
                      ["hook", "/home/plum/meemi-hook.svg"],
                      ["celebrate", "/home/plum/meemi-celebrate.svg"],
                    ] as const
                  ).map(([name, src]) => (
                    <Image
                      key={name}
                      src={src}
                      alt=""
                      width={360}
                      height={360}
                      unoptimized
                      className={cn(
                        "absolute inset-0 size-full max-w-none transition-opacity duration-[180ms]",
                        pose === name ? "opacity-100" : "opacity-0",
                      )}
                    />
                  ))}
                </div>

                {/* Product card: comes out of the hook once Meemi is done. */}
                {phase === "done" && product && (
                  <>
                    {[
                      { left: 300, top: 40, size: 44, delay: 0 },
                      { left: 520, top: 120, size: 30, delay: 80 },
                      { left: 440, top: -10, size: 34, delay: 140 },
                    ].map((spark) => (
                      <div
                        key={`${run}-${spark.left}`}
                        className="pl-sparkle absolute"
                        style={{
                          left: spark.left,
                          top: spark.top,
                          width: spark.size,
                          height: spark.size,
                          animationDelay: `${spark.delay}ms`,
                        }}
                      >
                        <Image
                          src="/home/plum/sparkle.svg"
                          alt=""
                          width={103}
                          height={103}
                          unoptimized
                          className="absolute inset-[8.33%] size-[83.34%] max-w-none"
                        />
                      </div>
                    ))}
                  </>
                )}

                {/* Speech bubble — role="status" lives outside the aria-hidden
                    scene, below, so it is announced exactly once. */}
              </div>

              {/* Card is a real link, so it sits outside the aria-hidden scene. */}
              {phase === "done" && product && (
                <div
                  className="absolute origin-top-left"
                  style={{ left: 313 * scale, top: 1 * scale, transform: `scale(${scale})` }}
                >
                <Link
                  key={`card-${run}`}
                  href={`/products/${product.slug}`}
                  aria-label={`${product.name}, ${formatMoney(product.priceCents)} — see pattern`}
                  className="pl-focus pl-card-in block w-[215px] rotate-[4deg] rounded-[20px] bg-pl-surface px-[9px] pt-[9px] pb-3 shadow-[0_26px_40px_-24px_rgba(36,18,64,0.35)]"
                >
                  <span className="relative block size-[196px] overflow-hidden rounded-[16px] bg-pl-tint-crochet">
                    {product.imageUrl && (
                      <Image
                        src={product.imageUrl}
                        alt=""
                        fill
                        sizes="196px"
                        className="object-cover"
                        priority
                      />
                    )}
                  </span>
                  <span className="mt-2.5 flex flex-col gap-0.5 px-1">
                    <span className="text-[11px] leading-[18px] font-bold tracking-[0.08em] text-plum-500 uppercase">
                      {product.categoryName}
                    </span>
                    <span className="line-clamp-1 text-base leading-[22px] font-bold tracking-[-0.005em] text-pl-text">
                      {product.name}
                    </span>
                  </span>
                  <span className="mt-2.5 flex items-center justify-between px-1">
                    <span className="pl-display pl-price">{formatMoney(product.priceCents)}</span>
                    <span className="rounded-full bg-pl-buy px-3 py-[7px] text-[13px] leading-[18px] font-bold text-pl-text">
                      See pattern
                    </span>
                  </span>
                </Link>
                </div>
              )}

              <p
                role="status"
                aria-live="polite"
                key={line}
                className="pl-bubble font-figtree absolute rounded-[16px] rounded-bl-[4px] bg-pl-surface px-3.5 py-2.5 text-base leading-[22px] font-bold tracking-[-0.005em] whitespace-nowrap text-pl-text shadow-[0_10px_22px_-8px_rgba(36,18,64,0.18)]"
                style={{
                  left: 70 * scale,
                  top: 22 * scale,
                  transform: `scale(${Math.max(scale, 0.8)})`,
                  transformOrigin: "top left",
                }}
              >
                {line}
              </p>
            </div>
          </div>

          {/* Picker */}
          {products.length > 0 && (
            <div
              role="group"
              aria-label="What should Meemi make?"
              className="flex flex-col items-center gap-2 lg:items-end"
            >
              <p className="text-[13px] leading-4 font-bold tracking-[0.01em] text-pl-muted">
                What should Meemi make?
              </p>
              <div className="flex flex-wrap justify-center gap-2 lg:flex-nowrap lg:justify-end">
                {products.map((item, index) => {
                  const active = picked === index && phase !== "hello";
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={askMeemi ? undefined : active}
                      aria-haspopup={askMeemi ? "dialog" : undefined}
                      onClick={() =>
                        askMeemi
                          ? useAskMeemi.getState().openPanel({ ask: `Show me ${item.name}` })
                          : pick(index)
                      }
                      className={cn(
                        "pl-focus font-figtree inline-flex items-center gap-2 rounded-full border-2 py-[7px] pr-3.5 pl-[7px] text-sm leading-[18px] font-bold whitespace-nowrap transition-colors lg:max-w-[176px]",
                        active
                          ? "border-plum-900 bg-plum-900 text-pl-on-dark"
                          : "border-plum-200 bg-pl-surface text-pl-text hover:border-plum-500",
                      )}
                    >
                      <span className="relative size-[26px] shrink-0 overflow-hidden rounded-[13px] bg-pl-tint-crochet">
                        {item.imageUrl && (
                          <Image src={item.imageUrl} alt="" fill sizes="26px" className="object-cover" />
                        )}
                      </span>
                      <span className="truncate">{shortName(item.name)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
