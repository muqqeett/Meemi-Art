import type { SVGProps } from "react";

/**
 * Brand glyphs for the footer.
 *
 * lucide-react v1 removed third-party brand icons, so these are drawn here as
 * filled paths. They take the same `className` sizing convention as the lucide
 * icons used elsewhere, and are always `aria-hidden` — the accessible name
 * lives on the surrounding link.
 */
type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "currentColor",
  "aria-hidden": true,
  focusable: false,
} as const;

export function InstagramIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.2 3h7.6A5.2 5.2 0 0 1 21 8.2v7.6a5.2 5.2 0 0 1-5.2 5.2H8.2A5.2 5.2 0 0 1 3 15.8V8.2A5.2 5.2 0 0 1 8.2 3Zm0 1.9A3.3 3.3 0 0 0 4.9 8.2v7.6a3.3 3.3 0 0 0 3.3 3.3h7.6a3.3 3.3 0 0 0 3.3-3.3V8.2a3.3 3.3 0 0 0-3.3-3.3H8.2Zm8.35 1.42a1.13 1.13 0 1 1 0 2.26 1.13 1.13 0 0 1 0-2.26ZM12 7.35a4.65 4.65 0 1 1 0 9.3 4.65 4.65 0 0 1 0-9.3Zm0 1.9a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5Z"
      />
    </svg>
  );
}

export function PinterestIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2a10 10 0 0 0-3.65 19.31c-.09-.78-.17-1.98.03-2.83.19-.79 1.2-5.04 1.2-5.04s-.3-.61-.3-1.52c0-1.42.82-2.48 1.85-2.48.87 0 1.29.66 1.29 1.44 0 .88-.56 2.19-.85 3.41-.24 1.02.51 1.85 1.52 1.85 1.83 0 3.23-1.93 3.23-4.71 0-2.46-1.77-4.18-4.29-4.18-2.92 0-4.64 2.19-4.64 4.46 0 .88.34 1.83.77 2.35a.31.31 0 0 1 .07.3c-.08.33-.26 1.02-.29 1.16-.05.19-.16.23-.36.14-1.35-.63-2.19-2.6-2.19-4.19 0-3.4 2.47-6.53 7.13-6.53 3.74 0 6.65 2.67 6.65 6.23 0 3.72-2.34 6.71-5.6 6.71-1.09 0-2.12-.57-2.47-1.24l-.67 2.56c-.24.94-.9 2.11-1.34 2.83A10 10 0 1 0 12 2Z" />
    </svg>
  );
}

export function FacebookIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M14.5 8.5V6.9c0-.74.17-1.12 1.3-1.12h1.45V3.1c-.35-.05-1.19-.1-2.17-.1-2.17 0-3.66 1.32-3.66 3.75V8.5H9v3h2.42V21h3.08v-9.5h2.52l.37-3H14.5Z" />
    </svg>
  );
}
