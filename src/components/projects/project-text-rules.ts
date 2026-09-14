import { PROJECT_CAPTION_MAX, PROJECT_DISPLAY_NAME_MAX } from "@/lib/validations/commerce";

/**
 * Early, friendly feedback for the words on a project.
 *
 * A mirror of the server's rules for the cases a customer is likely to hit —
 * length, a display name on one line, an email address typed as a name — so
 * a form can say so before anything is sent. It is not the check: the server
 * validates every submission and edit again, including rules not repeated
 * here.
 */
export function projectTextErrors(values: { caption: string; displayName: string }): {
  caption?: string;
  displayName?: string;
} {
  const errors: { caption?: string; displayName?: string } = {};
  const caption = values.caption.trim();
  const displayName = values.displayName.trim();

  if (caption.length > PROJECT_CAPTION_MAX) {
    errors.caption = `Keep the caption to ${PROJECT_CAPTION_MAX} characters.`;
  }
  if (displayName.length > PROJECT_DISPLAY_NAME_MAX) {
    errors.displayName = `Keep the display name to ${PROJECT_DISPLAY_NAME_MAX} characters.`;
  } else if (/[\r\n\t]/.test(displayName)) {
    errors.displayName = "Use a single line for the display name.";
  } else if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(displayName)) {
    errors.displayName = "Don't use an email address as a display name.";
  }

  return errors;
}
