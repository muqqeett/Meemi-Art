/**
 * Meemi's memory for one browser session — just enough not to interrupt twice.
 *
 * Stored in `sessionStorage`, so it ends with the tab. It holds no personal
 * data: product ids already visible in the page, the names of tips already
 * shown, and whether the customer asked Meemi to stay quiet.
 *
 *   quiet    set by "Not now": no greeting, no nudges, no reactions for the
 *            rest of the session. Meemi still opens when the customer asks.
 *   greeted  products whose greeting has been shown
 *   seen     `${productId}:${kind}` for nudges and reactions already shown
 *
 * Pure functions over a plain value, so the rules are testable without a
 * browser; `readMeemiSession` / `writeMeemiSession` tolerate storage that is
 * missing, full, blocked or holding garbage.
 */

export const MEEMI_SESSION_KEY = "meemiart:meemi";

const MAX_GREETED = 30;
const MAX_SEEN = 120;

export type MeemiSession = {
  quiet: boolean;
  greeted: string[];
  seen: string[];
};

export const EMPTY_MEEMI_SESSION: MeemiSession = { quiet: false, greeted: [], seen: [] };

const stringList = (value: unknown, max: number): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length <= 200).slice(-max)
    : [];

export function parseMeemiSession(raw: string | null): MeemiSession {
  if (!raw) return EMPTY_MEEMI_SESSION;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== "object") return EMPTY_MEEMI_SESSION;
    return {
      quiet: value.quiet === true,
      greeted: stringList(value.greeted, MAX_GREETED),
      seen: stringList(value.seen, MAX_SEEN),
    };
  } catch {
    return EMPTY_MEEMI_SESSION;
  }
}

export function shouldGreet(session: MeemiSession, productId: string): boolean {
  return !session.quiet && !session.greeted.includes(productId);
}

export function markGreeted(session: MeemiSession, productId: string): MeemiSession {
  if (session.greeted.includes(productId)) return session;
  return { ...session, greeted: [...session.greeted, productId].slice(-MAX_GREETED) };
}

/** May an unrequested message of this kind appear for this product? */
export function mayInterrupt(session: MeemiSession, productId: string, kind: string): boolean {
  return !session.quiet && !session.seen.includes(`${productId}:${kind}`);
}

export function markSeen(session: MeemiSession, productId: string, kind: string): MeemiSession {
  const entry = `${productId}:${kind}`;
  if (session.seen.includes(entry)) return session;
  return { ...session, seen: [...session.seen, entry].slice(-MAX_SEEN) };
}

export function setQuiet(session: MeemiSession): MeemiSession {
  return session.quiet ? session : { ...session, quiet: true };
}

export function readMeemiSession(storage: Pick<Storage, "getItem"> | null | undefined): MeemiSession {
  try {
    return parseMeemiSession(storage?.getItem(MEEMI_SESSION_KEY) ?? null);
  } catch {
    return EMPTY_MEEMI_SESSION;
  }
}

export function writeMeemiSession(storage: Pick<Storage, "setItem"> | null | undefined, session: MeemiSession): void {
  try {
    storage?.setItem(MEEMI_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Private mode, quota or blocked storage: Meemi simply forgets sooner.
  }
}
