"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Segmented tabs — Plum Studio "Tab" (12:322) on an ink-100 pill track.
 *
 *   track    ink-100, pill, 4px padding
 *   segment  36px tall, 12px radius, 14/18 bold
 *   active   white, lifted on the small two-layer shadow
 *
 * The design's three segments are Details / What's included / Reviews. This
 * product's panels carry what a buyer of a file needs — what it is, what
 * arrives, and what happens if it is wrong. Reviews have their own section
 * further down the page, so a tab for them would duplicate it.
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
        className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-pl-sunken p-1"
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
                "pl-focus font-figtree h-9 rounded-[12px] px-4 text-[14px] leading-[18px] font-bold whitespace-nowrap transition-colors",
                selected
                  ? "bg-pl-surface text-pl-text shadow-pl-sm"
                  : "text-pl-muted hover:text-pl-text",
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
          className="font-figtree text-base leading-[26px] text-pl-muted"
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
