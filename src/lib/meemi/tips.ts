import type { DifficultyLevel } from "@/lib/difficulty/engine";
import type { MeemiFacts } from "@/lib/meemi/facts";

/**
 * Everything Meemi says, as deterministic functions of verified facts.
 *
 * No message here states anything that is not in `MeemiFacts`, and a message
 * whose fact is missing is not produced at all — there is no fallback wording
 * that guesses. Copy is short, warm and sparing with emoji: one, at the start,
 * at most.
 */

export type MeemiAction =
  | "show-guide"
  | "not-now"
  | "next"
  | "done"
  | "explain-difficulty"
  | "show-techniques"
  | "ask";

export type MeemiTipKind =
  | "greeting"
  | "menu"
  | "guide"
  | "explain-difficulty"
  | "techniques"
  | "section-difficulty"
  | "section-techniques"
  | "wishlist"
  | "cart";

export type MeemiTip = {
  kind: MeemiTipKind;
  /** A single leading emoji, rendered decoratively. */
  emoji: string;
  text: string;
  actions: MeemiAction[];
};

export const MEEMI_ACTION_LABELS: Record<MeemiAction, string> = {
  "show-guide": "Show me",
  "not-now": "Not now",
  next: "Next tip",
  done: "Done",
  "explain-difficulty": "Explain difficulty",
  "show-techniques": "Show techniques",
  ask: "Ask Meemi",
};

const LEVEL_LINES: Record<DifficultyLevel, string> = {
  BEGINNER: "This one is beginner-friendly!",
  EASY: "This one is a gentle step up from beginner.",
  INTERMEDIATE: "This one needs a little more crochet experience.",
  ADVANCED: "This is a more challenging pattern. Ready for it?",
  EXPERT: "This is one of our most demanding patterns — best for experienced makers.",
};

/** "a", "a and b", "a, b and c". */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Sentence-internal form of a vocabulary label: "Magic ring" → "magic ring", "3D elements" unchanged. */
function inSentence(label: string): string {
  return /^[A-Z][a-z]/.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label;
}

/** "About 2–3 hours" → "about 2–3 hours". */
function timePhrase(estimatedTime: string): string {
  return estimatedTime.charAt(0).toLowerCase() + estimatedTime.slice(1);
}

/** Techniques named in one tip, so a bubble stays a bubble. */
const MAX_TECHNIQUES_IN_TIP = 4;

function techniqueSentence(techniques: readonly string[]): string {
  const shown = techniques.slice(0, MAX_TECHNIQUES_IN_TIP).map(inSentence);
  const more = techniques.length - shown.length;
  return more > 0 ? `${shown.join(", ")} and ${more} more` : joinList(shown);
}

export function greetingTip(): MeemiTip {
  return {
    kind: "greeting",
    emoji: "👋",
    text: "Hi! I'm Meemi. Want a quick guide to this pattern?",
    actions: ["show-guide", "not-now"],
  };
}

/**
 * The quick guide: level, time, techniques, then the digital note — each only
 * when its fact exists. Empty when there is nothing verified to say.
 */
export function guideTips(facts: MeemiFacts): MeemiTip[] {
  const tips: MeemiTip[] = [];
  if (facts.difficulty) {
    tips.push({ kind: "guide", emoji: "🧶", text: LEVEL_LINES[facts.difficulty.level], actions: [] });
  }
  if (facts.estimatedTime) {
    tips.push({
      kind: "guide",
      emoji: "⏱",
      text: `You can expect ${timePhrase(facts.estimatedTime)} for this project.`,
      actions: [],
    });
  }
  if (facts.techniques.length > 0) {
    tips.push({
      kind: "guide",
      emoji: "🧵",
      text: `You'll be using ${techniqueSentence(facts.techniques)}.`,
      actions: [],
    });
  }
  if (facts.isDigital) {
    tips.push({ kind: "guide", emoji: "📄", text: "This is a digital pattern — no shipping needed.", actions: [] });
  }
  return tips.map((tip, index) => ({
    ...tip,
    actions: index < tips.length - 1 ? ["next", "ask"] : ["ask", "done"],
  }));
}

/** What Meemi offers when the customer opens it themselves. */
export function menuTip(facts: MeemiFacts): MeemiTip {
  const actions: MeemiAction[] = [];
  if (guideTips(facts).length > 0) actions.push("show-guide");
  if (facts.difficulty) actions.push("explain-difficulty");
  actions.push("ask");
  return { kind: "menu", emoji: "🧶", text: "Hi again! What would you like to know about this pattern?", actions };
}

/** The level, the score and what makes it demanding — or null without an assessment. */
export function explainDifficultyTip(facts: MeemiFacts): MeemiTip | null {
  const difficulty = facts.difficulty;
  if (!difficulty) return null;
  const rated = `It's rated ${difficulty.levelLabel}, ${difficulty.score} out of 10.`;
  const why =
    difficulty.challenges.length > 0
      ? ` The trickier parts: ${joinList(difficulty.challenges.map(inSentence))}.`
      : " Nothing in it stands out as especially demanding.";
  return { kind: "explain-difficulty", emoji: "💡", text: `${rated}${why}`, actions: ["ask", "done"] };
}

export function techniquesTip(facts: MeemiFacts): MeemiTip | null {
  if (facts.techniques.length === 0) return null;
  return {
    kind: "techniques",
    emoji: "🧵",
    text: `The main techniques: ${joinList(facts.techniques.map(inSentence))}.`,
    actions: ["ask", "done"],
  };
}

/** A quiet nudge when the customer reaches a section — only where there is something verified behind it. */
export function sectionTip(section: "difficulty" | "techniques", facts: MeemiFacts): MeemiTip | null {
  if (section === "difficulty") {
    if (!facts.difficulty) return null;
    return {
      kind: "section-difficulty",
      emoji: "💡",
      text: "Not sure about the level? I can explain what makes this pattern challenging.",
      actions: ["explain-difficulty"],
    };
  }
  if (facts.techniques.length === 0) return null;
  return {
    kind: "section-techniques",
    emoji: "🧵",
    text: "These are the main techniques you'll use.",
    actions: ["show-techniques"],
  };
}

export function reactionTip(event: "wishlist" | "cart"): MeemiTip {
  return event === "wishlist"
    ? { kind: "wishlist", emoji: "💜", text: "Nice choice! This one is saved to your wishlist.", actions: [] }
    : { kind: "cart", emoji: "✨", text: "Great choice! Your pattern is ready when you are.", actions: [] };
}
