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
 * The whole description is always in the markup. The collapsed state hides the
 * remainder with the `hidden` attribute rather than slicing the string, which
 * matters more than it looks: these descriptions carry the skill level, the
 * materials, what is in the file and the usage terms, and cutting at 260
 * characters meant roughly two thirds of that never reached the HTML at all.
 *
 * The toggle is a disclosure rather than a second render path — one copy of the
 * text in the DOM, `aria-expanded` and `aria-controls` tying the button to the
 * part it reveals — so a reader with JavaScript off and anything reading the
 * page for its content both get the description the shop actually wrote.
 */
const COLLAPSED_CHARS = 260;

/** Break at a word boundary so the collapsed line does not end mid-word. */
function splitAt(text: string, limit: number): [string, string] {
  if (text.length <= limit) return [text, ""];
  const space = text.lastIndexOf(" ", limit);
  const cut = space > limit * 0.6 ? space : limit;
  return [text.slice(0, cut).trimEnd(), text.slice(cut)];
}

export function PdpDescription({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const needsToggle = text.length > COLLAPSED_CHARS;
  const [head, rest] = needsToggle ? splitAt(text, COLLAPSED_CHARS) : [text, ""];
  const collapsed = needsToggle && !open;

  return (
    <div className="flex flex-col gap-2.5">
      <h2 className="font-raleway text-xl leading-[1.2] font-bold text-pdp-title">
        Description:
      </h2>

      <p className="font-clash text-base leading-[1.3] whitespace-pre-line text-pdp-body">
        {head}
        {collapsed && "… "}
        {needsToggle && (
          <span id="pdp-description-rest" hidden={collapsed}>
            {rest}
          </span>
        )}
        {needsToggle && (
          <>
            {!collapsed && " "}
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={!collapsed}
              aria-controls="pdp-description-rest"
              className="font-clash font-medium text-black underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pdp-price"
            >
              {collapsed ? "See More...." : "See Less"}
            </button>
          </>
        )}
      </p>
    </div>
  );
}
