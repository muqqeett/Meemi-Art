/**
 * Announcement bar — Figma 222:46.
 *
 *   band  #BDCFF4, 56px tall, 12px vertical padding
 *   text  Segoe UI Semibold 22/28, #191919, centred
 *
 * The design sets this in caps *and* applies `text-transform: capitalize`,
 * which in a browser leaves already-uppercase text untouched. Rendered as
 * written rather than reproducing a rule that does nothing.
 */
export function AnnouncementBar() {
  return (
    <div className="flex w-full items-center justify-center bg-sky py-3">
      <p className="font-ui px-5 text-center text-base leading-7 font-semibold text-near-black sm:text-lg lg:text-[22px]">
        INSTANT DOWNLOAD. 100% HANDCRAFTED.
      </p>
    </div>
  );
}
