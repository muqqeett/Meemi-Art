"use client";

import { useState } from "react";

/**
 * Description with the design's inline "See More...." toggle — Figma 57:1382.
 *
 *   label  Raleway Bold 20/1.2, #292929
 *   body   Clash Grotesk Regular 16/1.3, #666
 *   more   Clash Grotesk Medium, black, inline at the end of the text
 *
 * Collapsed by character count rather than by a CSS line clamp, because the
 * design puts "See More...." on the same line as the truncated sentence — a
 * clamp would hide the toggle along with the overflow.
 *
 * The full text is always in the markup, so a reader with JavaScript off, and
 * anything reading the page for its content, gets the whole description.
 */
const COLLAPSED_CHARS = 260;

export function PdpDescription({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const needsToggle = text.length > COLLAPSED_CHARS;

  return (
    <div className="flex flex-col gap-2.5">
      <h2 className="font-raleway text-xl leading-[1.2] font-bold text-pdp-title">
        Description:
      </h2>

      <p className="font-clash text-base leading-[1.3] whitespace-pre-line text-pdp-body">
        {needsToggle && !open ? (
          <>
            {text.slice(0, COLLAPSED_CHARS).trimEnd()}
            {"… "}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="font-clash font-medium text-black underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pdp-price"
            >
              See More....
            </button>
          </>
        ) : (
          <>
            {text}
            {needsToggle && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="font-clash font-medium text-black underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pdp-price"
                >
                  See Less
                </button>
              </>
            )}
          </>
        )}
      </p>
    </div>
  );
}
