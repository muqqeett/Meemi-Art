import type { ReactNode } from "react";

/**
 * Hand-authored stitch diagrams.
 *
 * Drawn here as SVG rather than photographed, for one reason: a diagram can be
 * exactly right. These reproduce the standard crochet chart symbols as they
 * appear in published patterns, so a reader meeting a chart for the first time
 * can match the shape on the page to the stitch it means.
 *
 * Nothing in this registry is decorative, and nothing here pretends to be
 * photography. A diagram is added only where the drawing genuinely explains
 * something words alone leave ambiguous.
 *
 * Every diagram carries a `<title>` and `<desc>`, so the information is
 * available to a screen reader rather than locked inside the picture — and
 * every page that uses one also states the same thing in prose.
 */

type Diagram = {
  /** Announced as the accessible name. */
  title: string;
  /** The long description, for anyone who cannot see the drawing. */
  description: string;
  render: () => ReactNode;
};

const stroke = {
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  fill: "none",
};

const DIAGRAMS: Record<string, Diagram> = {
  "chart-symbols": {
    title: "Standard crochet chart symbols",
    description:
      "Five symbols in a row. An oval stands for a chain. A cross stands for a single crochet. A T stands for a half double crochet. A T with one bar across its stem stands for a double crochet. A T with two bars stands for a treble crochet. Each added bar means one more yarn over, and one more stitch of height.",
    render: () => (
      <svg viewBox="0 0 420 120" className="h-auto w-full max-w-md text-foreground" role="img" aria-hidden>
        {/* chain — an oval */}
        <ellipse cx="40" cy="70" rx="18" ry="9" {...stroke} />
        <text x="40" y="104" textAnchor="middle" className="fill-current text-[11px]">ch</text>

        {/* single crochet — a cross */}
        <path d="M112 56 L136 84 M136 56 L112 84" {...stroke} />
        <text x="124" y="104" textAnchor="middle" className="fill-current text-[11px]">sc</text>

        {/* half double crochet — a T */}
        <path d="M196 50 L224 50 M210 50 L210 88" {...stroke} />
        <text x="210" y="104" textAnchor="middle" className="fill-current text-[11px]">hdc</text>

        {/* double crochet — a T with one bar */}
        <path d="M282 44 L310 44 M296 44 L296 88 M288 64 L304 60" {...stroke} />
        <text x="296" y="104" textAnchor="middle" className="fill-current text-[11px]">dc</text>

        {/* treble crochet — a T with two bars */}
        <path d="M368 38 L396 38 M382 38 L382 88 M374 58 L390 54 M374 72 L390 68" {...stroke} />
        <text x="382" y="104" textAnchor="middle" className="fill-current text-[11px]">tr</text>
      </svg>
    ),
  },

  "magic-ring": {
    title: "The structure of a magic ring",
    description:
      "A loop of yarn is formed so that the working yarn crosses over the tail. Single crochet stitches are then worked over the doubled strand that makes up the loop — not into a chain — so there is no chain to leave a hole. Pulling the tail draws that doubled strand closed, and the stitches gather into a ring with no gap at the centre.",
    render: () => (
      <svg viewBox="0 0 420 200" className="h-auto w-full max-w-md text-foreground" role="img" aria-hidden>
        {/* the doubled loop the stitches are worked over */}
        <circle cx="150" cy="100" r="52" {...stroke} />
        <circle cx="150" cy="100" r="44" {...stroke} strokeDasharray="4 5" />

        {/* six single crochet worked over the doubled strand */}
        {[0, 60, 120, 180, 240, 300].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x = 150 + Math.cos(rad) * 48;
          const y = 100 + Math.sin(rad) * 48;
          return (
            <path key={deg} d={`M${x - 8} ${y - 8} L${x + 8} ${y + 8} M${x + 8} ${y - 8} L${x - 8} ${y + 8}`} {...stroke} />
          );
        })}

        {/* the tail that closes the ring */}
        <path d="M150 152 C150 178 120 186 96 182" {...stroke} />
        <text x="72" y="186" textAnchor="end" className="fill-current text-[11px]">pull the tail</text>

        {/* the working yarn */}
        <path d="M202 100 C232 100 244 82 258 70" {...stroke} />
        <text x="266" y="68" className="fill-current text-[11px]">working yarn</text>

        <text x="150" y="104" textAnchor="middle" className="fill-current text-[11px]">closes</text>
        <text x="332" y="150" textAnchor="middle" className="fill-current text-[11px]">✕ = sc</text>
      </svg>
    ),
  },

  "spiral-vs-joined": {
    title: "Continuous rounds compared with joined rounds",
    description:
      "On the left, a continuous spiral: the work carries on past the start of the round without a join, so the beginning of each round shifts around the piece and a stitch marker is what records where it is. On the right, joined rounds: each round is closed with a slip stitch into its own first stitch, which stacks those joins into a visible vertical seam.",
    render: () => (
      <svg viewBox="0 0 420 190" className="h-auto w-full max-w-md text-foreground" role="img" aria-hidden>
        {/* continuous spiral — one unbroken line, no join */}
        <path
          d="M104 86 C104 70 90 60 74 60 C52 60 38 78 38 100 C38 128 60 148 88 148 C122 148 148 122 148 88 C148 50 118 22 80 22"
          {...stroke}
        />
        <circle cx="104" cy="86" r="5" className="fill-current" />
        <text x="93" y="180" textAnchor="middle" className="fill-current text-[11px]">continuous spiral</text>
        <text x="158" y="26" className="fill-current text-[10px]">marker moves up</text>

        {/* joined rounds — concentric rings with a stacked seam */}
        <circle cx="318" cy="86" r="26" {...stroke} />
        <circle cx="318" cy="86" r="44" {...stroke} />
        <circle cx="318" cy="86" r="62" {...stroke} />
        <path d="M318 24 L318 148" {...stroke} strokeDasharray="5 4" />
        <text x="318" y="180" textAnchor="middle" className="fill-current text-[11px]">joined rounds</text>
        <text x="330" y="18" className="fill-current text-[10px]">seam</text>
      </svg>
    ),
  },

  "invisible-decrease": {
    title: "Where an invisible decrease is worked",
    description:
      "The top of each stitch is a pair of loops: a front loop nearer you and a back loop behind it. An invisible decrease goes under the front loop only of the next stitch and then under the front loop only of the stitch after it, so the hook holds two front loops. Those two are then worked off together as one stitch. An ordinary decrease takes both loops of each stitch instead, which leaves a larger opening.",
    render: () => (
      <svg viewBox="0 0 420 190" className="h-auto w-full max-w-md text-foreground" role="img" aria-hidden>
        {/* two stitch tops, each drawn as a front and a back loop */}
        {[130, 250].map((x, index) => (
          <g key={x}>
            {/* back loop, behind */}
            <ellipse cx={x} cy="74" rx="26" ry="12" {...stroke} strokeDasharray="4 4" />
            {/* front loop, nearer the reader */}
            <ellipse cx={x} cy="94" rx="26" ry="12" {...stroke} />
            {/* the post of the stitch */}
            <path d={`M${x} 106 L${x} 140`} {...stroke} />
            <text x={x} y="162" textAnchor="middle" className="fill-current text-[11px]">
              {index === 0 ? "next st" : "st after"}
            </text>
          </g>
        ))}

        {/* the hook's path: front loop, then front loop */}
        <path d="M104 94 L276 94" {...stroke} strokeDasharray="7 5" />
        <path d="M268 86 L278 94 L268 102" {...stroke} />
        <text x="190" y="34" textAnchor="middle" className="fill-current text-[11px]">
          hook goes under both front loops
        </text>
        <path d="M190 42 L190 62 M182 54 L190 62 L198 54" {...stroke} />

        <text x="348" y="78" className="fill-current text-[10px]">back loop</text>
        <text x="348" y="98" className="fill-current text-[10px]">front loop</text>
      </svg>
    ),
  },

  "repeat-brackets": {
    title: "What a bracketed repeat covers",
    description:
      "In the instruction to work single crochet then an increase six times, the bracket encloses only the two stitches that repeat: one single crochet and one increase. The number after the bracket says how many times that pair is worked. The count in parentheses at the end of the line is not part of the repeat — it is the number of stitches the round should contain when the repeat is finished.",
    render: () => (
      <svg viewBox="0 0 420 150" className="h-auto w-full max-w-md text-foreground" role="img" aria-hidden>
        {/* the bracket over the repeated group */}
        <path d="M74 56 L74 40 L214 40 L214 56" {...stroke} />
        <text x="144" y="30" textAnchor="middle" className="fill-current text-[11px]">this group repeats</text>

        {/* the instruction, spaced so each part can be labelled */}
        <text x="74" y="86" className="fill-current font-mono text-[15px]">(</text>
        <text x="90" y="86" className="fill-current font-mono text-[15px]">sc, inc</text>
        <text x="172" y="86" className="fill-current font-mono text-[15px]">)</text>
        <text x="192" y="86" className="fill-current font-mono text-[15px]">x 6</text>
        <text x="252" y="86" className="fill-current font-mono text-[15px]">(18)</text>

        {/* what the trailing count means */}
        <path d="M268 98 L268 118 L330 118" {...stroke} />
        <text x="336" y="122" className="fill-current text-[11px]">stitches at the end</text>

        <path d="M206 98 L206 118 L150 118" {...stroke} />
        <text x="144" y="122" textAnchor="end" className="fill-current text-[11px]">times to work it</text>
      </svg>
    ),
  },
};

export function hasDiagram(name: string): boolean {
  return Object.hasOwn(DIAGRAMS, name);
}

export function diagramNames(): string[] {
  return Object.keys(DIAGRAMS);
}

export function StitchDiagram({ name, caption }: { name: string; caption?: string }) {
  const diagram = DIAGRAMS[name];
  if (!diagram) return null;

  return (
    <figure className="rounded-sm border border-border bg-surface-alt/50 px-5 py-6">
      <div className="flex justify-center">{diagram.render()}</div>
      <figcaption className="text-body mt-4 text-xs leading-relaxed">
        <span className="font-medium text-foreground">{diagram.title}.</span> {caption ?? diagram.description}
      </figcaption>
    </figure>
  );
}
