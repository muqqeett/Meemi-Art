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
        className="flex gap-1.5 rounded-full bg-pdp-surface p-1"
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
                "flex-1 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700",
                selected
                  ? "bg-surface text-pdp-title shadow-[0_0_3px_rgba(16,24,40,0.10),0_2px_5px_rgba(16,24,40,0.06)]"
                  : "text-pdp-body hover:text-pdp-title",
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
