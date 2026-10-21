import type { Metadata } from "next";
import Image from "next/image";

import { PlumColumn, PlumGround } from "@/components/content/plum";
import { PlumButtonLink } from "@/components/ui/plum-button";
import { siteConfig } from "@/lib/config";
import { shopCategoryFor } from "@/lib/shop-categories";

export const metadata: Metadata = {
  title: "About",
  description: `${siteConfig.name} is a small studio making crochet patterns and the digital tools behind a creative business — Notion systems, Canva templates, presets and printables.`,
  alternates: { canonical: "/about" },
  openGraph: {
    siteName: siteConfig.name,
    title: `About | ${siteConfig.name}`,
    description: `A tiny studio for people who make things.`,
    url: `${siteConfig.url}/about`,
    images: [siteConfig.ogImage],
  },
};

/**
 * Who is behind each file, as the design draws them. Loop, Pip and Snap are the
 * characters the shop's categories already use (crochet patterns, templates,
 * creator assets), so their artwork and placement come from the same list;
 * Meemi is the hello pose.
 */
const CREW = [
  { name: "Meemi", note: "A yarn bunny with a hook. Patient, curious and here for the big moments.", cast: null },
  { name: "Loop", note: "The yarn ball who looks after crochet patterns.", cast: "crochet-patterns" },
  { name: "Pip", note: "A tidy planner who keeps the templates and printables in order.", cast: "templates" },
  { name: "Snap", note: "A camera with an eye for presets and creator assets.", cast: "creator-assets" },
] as const;

function CrewAvatar({ cast }: { cast: (typeof CREW)[number]["cast"] }) {
  const spec = cast ? shopCategoryFor(cast) : undefined;
  return (
    <span aria-hidden className="relative block size-10 shrink-0 lg:size-12">
      {spec ? (
        <span className="absolute" style={{ inset: spec.placement.group }}>
          <span className="absolute" style={{ inset: spec.placement.bleed }}>
            <Image src={spec.art} alt="" fill unoptimized className="max-w-none object-fill" />
          </span>
        </span>
      ) : (
        <Image src="/auth/meemi-hello.svg" alt="" fill unoptimized className="object-contain" />
      )}
    </span>
  );
}

const VALUES = [
  {
    title: "Clear, tested files",
    body: "Product pages spell out the format and file size — and the skill level for patterns — so you know what you’re getting.",
  },
  {
    title: "Free updates",
    body: "Buy once and any fix we make to a file is yours to download again from your library.",
  },
  {
    title: "A real human",
    body: "Stuck on a round? Email us and the maker replies, usually within a day.",
  },
] as const;

const PROSE = "text-base leading-[26px] text-pl-muted lg:text-[17px] lg:leading-7";
const PROSE_HEADING = "pl-display text-2xl leading-[30px] font-bold lg:text-[28px] lg:leading-[34px]";

/**
 * About — Figma "About" (174:6464) and "Mobile/About" (174:14508).
 *
 * Hero → story with a photo → meet the crew → what you can count on → a
 * closing call to action. Meemi appears here on purpose: the design reserves
 * her for the big moments, and this is one.
 *
 * Where the design reaches for something the shop does not have, the page
 * stays honest: there is no free-pattern page, so the second call to action
 * points at the free guides; and "free updates" is worded as what the library
 * really does — a fixed file is downloadable again — rather than a promise
 * about future versions.
 */
export default function AboutPage() {
  return (
    <PlumGround>
      <section aria-labelledby="about-title" className="bg-pl-inverse">
        <PlumColumn className="flex flex-col items-start gap-3 py-8 lg:flex-row lg:items-center lg:gap-10 lg:py-14">
          <Image
            src="/auth/meemi-hello.svg"
            alt=""
            width={240}
            height={240}
            unoptimized
            priority
            className="size-[110px] shrink-0 lg:order-last lg:size-[240px]"
          />
          <div className="flex min-w-0 flex-col items-start gap-3 lg:flex-1 lg:gap-3.5">
            <p className="text-xs font-bold tracking-[0.08em] text-plum-300 uppercase lg:text-[13px]">
              About Meemi Art
            </p>
            <h1
              id="about-title"
              className="pl-display max-w-[720px] text-[34px] leading-[38px] text-pl-on-dark lg:text-[56px] lg:leading-[60px]"
            >
              A tiny studio for people who make things
            </h1>
            <p className="max-w-[640px] text-base leading-[25px] text-plum-200 lg:text-[19px] lg:leading-[29px]">
              We started with crochet and grew into templates, presets and printables. Every
              file is something we use ourselves.
            </p>
          </div>
        </PlumColumn>
      </section>

      {/* On a phone the order is intro, photo, then the rest; from `lg` the text
          is one column beside the photo. `contents` lets the paragraphs take
          part in the grid's ordering on a phone and stack as one column on desktop. */}
      <PlumColumn className="grid gap-y-3.5 pt-8 pb-4 lg:grid-cols-[minmax(0,620px)_minmax(0,548px)] lg:items-start lg:justify-between lg:gap-x-12 lg:pt-[72px] lg:pb-10">
        <div className="contents lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col lg:gap-4">
          <p className={`${PROSE} order-1`}>
            Meemi Art began at a kitchen table in Lahore with a hook, a ball of yarn and a fox
            that wouldn’t sit straight. Writing that pattern clearly enough for a total beginner
            turned into a habit, and then into a shop.
          </p>
          <h2 className={`${PROSE_HEADING} order-3`}>What we make</h2>
          <p className={`${PROSE} order-3`}>
            Beginner-friendly crochet patterns with photos for every round, and the digital tools
            we use to run a small creative business: Notion systems, Canva templates, presets and
            printables.
          </p>
          <h2 className={`${PROSE_HEADING} order-3`}>How we work</h2>
          <p className={`${PROSE} order-3`}>
            Every pattern is test-crocheted before it goes live. If you find a mistake, tell us
            and we’ll fix it for everyone. The update lands in your library for free.
          </p>
        </div>

        {/* Meemi stands in for the Sleepy Fox photo: the only copy of that photo
            in the design is a 200px thumbnail, too small to show at this size. */}
        <figure className="order-2 lg:col-start-2 lg:row-start-1">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-pl-tint-crochet lg:rounded-[28px]">
            <Image
              src="/home/plum/blob.svg"
              alt=""
              fill
              unoptimized
              className="object-contain p-[6%]"
            />
            <Image
              src="/home/plum/meemi-hook.svg"
              alt="Meemi, the yarn bunny, holding a crochet hook"
              fill
              unoptimized
              loading="eager"
              className="object-contain p-[5%]"
            />
          </div>
        </figure>
      </PlumColumn>

      <PlumColumn className="py-4 lg:py-10">
        <section
          aria-labelledby="crew-title"
          className="flex flex-col gap-5 rounded-[28px] bg-pl-subtle p-5 lg:flex-row lg:items-center lg:gap-12 lg:p-10"
        >
          <Image
            src="/about/crew-scene.svg"
            alt=""
            width={440}
            height={294}
            unoptimized
            className="h-auto w-[300px] max-w-full shrink-0 lg:w-[440px]"
          />
          <div className="flex min-w-0 flex-col gap-3.5 lg:gap-4">
            <p className="text-xs font-bold tracking-[0.08em] text-plum-500 uppercase lg:text-[13px]">
              Meet the crew
            </p>
            <h2
              id="crew-title"
              className="pl-display max-w-[560px] text-[26px] leading-[30px] font-bold lg:text-[32px] lg:leading-[38px]"
            >
              The little makers behind every file
            </h2>
            <ul className="flex flex-col gap-3.5 lg:gap-4">
              {CREW.map((member) => (
                <li key={member.name} className="flex items-center gap-3.5">
                  <CrewAvatar cast={member.cast} />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-base leading-[normal] font-bold text-pl-text lg:text-[17px]">
                      {member.name}
                    </span>
                    <span className="max-w-[480px] text-sm leading-[21px] text-pl-muted lg:text-[15px] lg:leading-[22px]">
                      {member.note}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </PlumColumn>

      <PlumColumn className="py-4 lg:pt-10 lg:pb-14">
        <section aria-labelledby="count-on-title" className="flex flex-col gap-3 lg:gap-5">
          <h2
            id="count-on-title"
            className="pl-display text-2xl leading-[30px] font-bold lg:text-[32px] lg:leading-[normal]"
          >
            What you can count on
          </h2>
          <ul className="grid items-start gap-3 lg:grid-cols-3 lg:gap-5">
            {VALUES.map((value) => (
              <li
                key={value.title}
                className="flex flex-col gap-2 rounded-[20px] border border-pl-line bg-pl-surface p-5 lg:p-6"
              >
                <h3 className="text-[17px] leading-[normal] font-bold text-pl-text lg:text-lg">
                  {value.title}
                </h3>
                <p className="text-sm leading-[22px] text-pl-muted lg:text-[15px] lg:leading-[23px]">
                  {value.body}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </PlumColumn>

      <PlumColumn className="pt-4 pb-10 lg:pt-0 lg:pb-16">
        <section
          aria-labelledby="cta-title"
          className="flex flex-col gap-3 rounded-[24px] bg-pl-tint-crochet px-5 py-6 lg:flex-row lg:items-center lg:gap-6 lg:rounded-[28px] lg:p-10"
        >
          <div className="flex flex-col gap-1.5 lg:flex-1">
            <h2
              id="cta-title"
              className="pl-display text-2xl leading-[normal] font-bold lg:text-[30px]"
            >
              Make your first cute thing
            </h2>
            <p className="text-[15px] leading-[normal] text-pl-muted lg:text-base">
              Start with a free guide, or pick a pattern from the shop.
            </p>
          </div>
          <PlumButtonLink href="/shop" style="buy" size="lg" className="w-full lg:w-auto">
            Shop patterns
          </PlumButtonLink>
          <PlumButtonLink href="/learn" style="secondary" size="lg" className="w-full lg:w-auto">
            Explore free guides
          </PlumButtonLink>
        </section>
      </PlumColumn>
    </PlumGround>
  );
}
