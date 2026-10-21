import Image from "next/image";

import type { AssistantMood } from "@/lib/assistant/types";
import { cn } from "@/lib/utils";

/**
 * Meemi's face for Ask Meemi — Figma "Meemi avatar" (186:4034): the real Meemi
 * poses cropped to face and ears on a lilac circle, one per mood. Drawn at 44px
 * in the panel header and the launcher, 28px beside each answer.
 *
 * Decorative: the mood is carried by the words next to it, so the image has an
 * empty alt and the avatar adds nothing a screen reader would have to skip.
 */
const SRC: Record<AssistantMood, string> = {
  hello: "/ask-meemi/hello.svg",
  looking: "/ask-meemi/looking.svg",
  happy: "/ask-meemi/happy.svg",
  curious: "/ask-meemi/curious.svg",
  unsure: "/ask-meemi/unsure.svg",
  helping: "/ask-meemi/helping.svg",
  napping: "/ask-meemi/napping.svg",
};

export function AskMeemiAvatar({
  mood,
  size = 44,
  className,
}: {
  mood: AssistantMood;
  size?: 28 | 44;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      data-mood={mood}
      className={cn("relative block shrink-0", size === 28 ? "size-7" : "size-11", className)}
    >
      <Image src={SRC[mood]} alt="" fill unoptimized sizes={`${size}px`} className="object-contain" />
    </span>
  );
}
