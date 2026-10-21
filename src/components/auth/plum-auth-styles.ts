/**
 * Class strings for the Plum Studio log-in and sign-up screens.
 *
 * One file so the field, the two buttons and the link are written once and the
 * two forms cannot drift. Values are the Figma file's own (nodes 149:3849 and
 * 159:4861, and the `Input` component 7:102), mapped onto the project's `pl-*`
 * and `plum-*` tokens rather than pasted as hex.
 *
 * Complete class strings, never assembled from fragments: Tailwind scans source
 * for whole names, and an interpolated one compiles to nothing.
 */

/** Field: 48px, 12px radius, 1.5px border; focus swaps the border to plum-500 and adds the 3px plum-100 ring. */
export const plumField =
  "font-figtree h-12 w-full rounded-[12px] border-[1.5px] border-pl-line-strong bg-pl-surface px-3.5 py-0 text-base leading-[26px] text-pl-text outline-none transition-[border-color,box-shadow] placeholder:text-pl-muted/70 focus-visible:border-plum-500 focus-visible:ring-[3px] focus-visible:ring-plum-100 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/15 sm:h-12 md:text-base";

/** Field label: 14/18 bold, always visible above the field. */
export const plumLabel = "text-sm leading-[18px] font-bold text-pl-text";

/** Hint under a field: 13/18 medium. */
export const plumHint = "text-[13px] leading-[18px] font-medium text-pl-muted";

/** Error under a field: says what is wrong, in the error colour, never colour alone. */
export const plumError = "text-[13px] leading-[18px] font-bold text-destructive";

/** Primary action: plum pill, 56px, 15/18 bold, inverse text. */
export const plumPrimary =
  "pl-focus inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-pl-inverse px-7 text-[15px] leading-[18px] font-bold text-pl-on-dark transition-colors hover:bg-plum-800 disabled:cursor-not-allowed disabled:opacity-60";

/** Secondary action: outlined pill, same size. */
export const plumSecondary =
  "pl-focus inline-flex h-14 w-full items-center justify-center gap-2 rounded-full border-[1.5px] border-pl-line-strong bg-pl-surface px-7 text-[15px] leading-[18px] font-bold text-pl-text transition-colors hover:bg-pl-subtle";

/** In-line link: plum-500, bold, underlined. */
export const plumLink =
  "pl-focus rounded-xs font-bold text-plum-500 underline decoration-solid underline-offset-[3px] transition-colors hover:text-plum-800";

/** Form-level error banner. */
export const plumAlert =
  "flex items-start gap-2.5 rounded-[16px] border border-destructive/30 bg-destructive/5 px-4 py-3.5 text-sm leading-[22px] font-bold text-destructive";

/** Non-error notice (e.g. "email delivery isn't configured"): warning colour, not the error colour. */
export const plumNotice =
  "rounded-[16px] border border-warning/30 bg-warning/5 px-4 py-3.5 text-sm leading-[22px] font-medium text-warning";

/** Inline success line, e.g. after asking for a fresh verification link. */
export const plumSuccess =
  "flex items-start gap-2.5 rounded-[16px] border border-success/30 bg-success/5 px-4 py-3.5 text-sm leading-[22px] font-bold text-success";
