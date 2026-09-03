"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * The segmented control under the buy row — Figma 8211:1523.
 *
 *   track    `#eaecf0`, 60px radius, 4px padding, full column width
 *   segment  equal width, 60px radius, 16px Medium
 *   active   white, lifted on a soft two-layer shadow
 *
 * The design's three segments are Details / Packaging / Shipping details. Two
 * of those describe a parcel. Nothing here is posted, so the panels carry what
 * a buyer of a file actually needs — what it is, what arrives, and what happens
 * if it is wrong — rather than an empty "Shipping" tab that would be a lie in a
 * tab bar.
 *
 * Built as a real ARIA tablist: roving `aria-selected`, arrow keys, and one
 * panel per tab, so a keyboard or screen-reader user gets the same three
 * sections a pointer user does.
 */
export type PdpTab = { id: string; label: string; panel: React.ReactNode };

export function PdpTabs({ tabs }: { tabs: PdpTab[] }) {
  const base = useId();
  const [active, setActive] = useState(0);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next =
      event.key === "ArrowRight"
        ? (active + 1) % tabs.length
        : (active - 1 + tabs.length) % tabs.length;
    setActive(next);
    document.getElementById(`${base}-tab-${next}`)?.focus();
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Product information"
        onKeyDown={onKeyDown}
        /* Was a grey pill track with a lifted white segment — the loudest
           object in the column, and the most generic. An underlined rule is
           how a magazine sets section navigation: the labels are the design,
           and the line tells you where you are. */
        className="flex gap-7 border-b border-pdp-hairline sm:gap-10"
      >
        {tabs.map((tab, index) => {
          const selected = index === active;
          return (
            <button
              key={tab.id}
              id={`${base}-tab-${index}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${base}-panel-${index}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              className={cn(
                "relative -mb-px pb-3.5 text-[0.6875rem] font-semibold tracking-[0.16em] whitespace-nowrap uppercase transition-colors duration-200",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700",
                // The rule wipes in from the left rather than cutting: a
                // transform, so it costs no layout and reads as the underline
                // travelling to the label you chose.
                "after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:origin-left after:bg-brand-600 after:transition-transform after:duration-200 after:ease-out",
                selected
                  ? "text-pdp-title after:scale-x-100"
                  : "text-pdp-label hover:text-pdp-title after:scale-x-0",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          id={`${base}-panel-${index}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${index}`}
          hidden={index !== active}
          className="text-base leading-[1.6] text-pdp-body"
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
