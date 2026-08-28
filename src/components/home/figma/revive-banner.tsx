import Image from "next/image";
import Link from "next/link";

import { Reveal } from "@/components/motion/reveal";
import { publicAsset } from "@/lib/public-asset";

/**
 * "Revive the Art" banner — Figma 222:414.
 *
 *   frame    1440 × 443.474 — card inset 120 x, 20 top, 60 bottom
 *   card     1200 × 363.474, 16.036px radius, clipped
 *   left     600px — the studio photograph, #EFECEA behind it
 *   right    600px — a sky photograph with the type centred over it
 *   heading  Segoe Script Bold 56/66, 1px tracking, centred:
 *            "Revive the" in white, "Art" in #FFA61E
 *   button   white pill, 48 tall, 178.663 wide, 24px side padding, 21.381px
 *            above it; "Explore More" in Segoe UI Semibold 20/30, #191919
 *
 * ---------------------------------------------------------------------------
 * The sky is missing from the repository, and cannot be pulled out of Figma.
 *
 * It is an image *fill* on the right-hand container rather than a child image
 * layer. `get_design_context` reports that container with no background at
 * all, and `download_assets` returns only the studio photograph — so the one
 * export that does contain the sky is the rendered panel, which has the
 * headline and button baked into it and is therefore useless as a backdrop.
 *
 * An earlier pass mistook Figma's 288 × 232 thumbnail of the *studio* photo
 * for the sky and saved it as `revive-sky.png`, which is why this panel was
 * showing the same picture as the half beside it.
 *
 * Until the real file is exported, the panel paints a vertical blue wash that
 * stands in for it: the white and amber type needs a dark-to-light blue ground
 * to stay legible, and cream did not provide it. Drop a 1200 × 727 (2×) export
 * at `public/home/revive-sky.png` and it is used automatically — no code
 * change. See the note in the reply for how to export it.
 * ---------------------------------------------------------------------------
 */
export function ReviveBanner() {
  const sky = publicAsset("/home/revive-sky.png");

  return (
    <section className="w-full bg-paper pt-5 pb-[60px]">
      <div className="container-figma">
        <Reveal variant="scale">
          <div className="grid overflow-hidden rounded-[16px] bg-cream sm:grid-cols-2">
            <div className="relative aspect-[600/363] w-full bg-[#efecea]">
              <Image
                src="/home/revive-the-art.png"
                alt="Four people painting a mural together in a studio"
                fill
                sizes="(min-width: 640px) 50vw, 100vw"
                className="object-cover"
              />
            </div>

            {/* The type sits on the sky, so the image is a sibling behind it
                rather than a CSS background — Next/Image can then size and
                serve it like every other photograph on the page. The wash
                underneath shows through while it loads, and stands in for it
                entirely when the export is absent. */}
            <div className="relative flex min-h-[220px] flex-col items-center justify-center bg-gradient-to-b from-[#2f6fbe] via-[#79aae2] to-[#cfe1f4] p-8 sm:min-h-0">
              {sky && (
                <Image
                  src={sky}
                  alt=""
                  aria-hidden
                  fill
                  sizes="(min-width: 640px) 600px, 100vw"
                  className="object-cover"
                />
              )}

              <div className="relative flex w-full max-w-[492px] flex-col items-center">
                <p className="font-script text-center text-[2.25rem] leading-tight font-bold tracking-[1px] text-white sm:text-[3rem] lg:text-[3.5rem] lg:leading-[66px]">
                  Revive the <span className="text-amber">Art</span>
                </p>

                {/* 12px between the heading block and the button's own 21.381
                    top margin — the design stacks the two rather than using a
                    single gap. */}
                <Link
                  href="/shop"
                  className="font-ui mt-[33px] inline-flex h-12 w-[178.663px] items-center justify-center rounded-full bg-white px-6 text-xl leading-[30px] font-semibold text-near-black shadow-[0px_3px_4px_-1px_rgba(0,0,0,0.15),0px_5px_10px_0px_rgba(0,0,0,0.1),0px_1px_12px_0px_rgba(0,0,0,0.1)] transition-transform duration-200 ease-out hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:scale-100"
                >
                  Explore More
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
