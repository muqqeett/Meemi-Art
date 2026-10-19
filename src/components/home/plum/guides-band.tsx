import Image from "next/image";
import Link from "next/link";

import { plumButtonClass } from "@/components/ui/plum-button";

/**
 * Lead-magnet band — Figma "Free pattern band" (17:787): a plum panel with the
 * hook-holding Meemi, an eyebrow, a 36px heading, a line of copy and a white
 * button.
 *
 * The design offers "a free Mini Heart Keychain … just add your email" and the
 * button goes to `/free`. There is no free pattern, no email capture and no such
 * route here. The free thing this shop really has is the learning section, so
 * the band says that and points at `/learn`.
 */
export function GuidesBand() {
  return (
    <section className="font-figtree mx-auto w-full max-w-[1280px] px-4 pt-4 pb-12 sm:px-8 lg:pb-16">
      <div className="flex flex-col items-start gap-6 rounded-[28px] bg-plum-900 px-6 py-8 sm:px-10 sm:py-10 lg:flex-row lg:items-center lg:gap-12 lg:px-14 lg:py-12">
        <Image
          src="/home/plum/band-meemi.svg"
          alt=""
          width={176}
          height={176}
          unoptimized
          className="size-[120px] shrink-0 sm:size-[144px] lg:size-[176px]"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="pl-eyebrow !text-plum-200">Free guides</p>
          <h2 className="pl-display pl-h2 max-w-[560px] !text-pl-on-dark">Start with a free guide</h2>
          <p className="max-w-[520px] text-base leading-[26px] text-plum-200">
            Abbreviations, hook sizes, yarn weights and a beginner’s guide — free to read, no
            account needed.
          </p>
        </div>
        <Link href="/learn" className={plumButtonClass({ style: "secondary", size: "lg" })}>
          Browse the guides
        </Link>
      </div>
    </section>
  );
}
