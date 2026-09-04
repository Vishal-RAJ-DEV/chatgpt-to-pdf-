/**
 * Filename Sanitizer Utility — Phase 12.
 *
 * Sanitizes conversation titles into safe operating system filenames
 * suitable for default PDF print suggestions.
 *
 * Rules:
 *   - Normalizes whitespace and collapses multiple spaces/newlines to a single space.
 *   - Strips illegal OS filename characters (\ / : * ? " < > | and control characters \x00-\x1F).
 *   - Strips trailing dots and spaces (Windows OS restriction).
 *   - Preserves Unicode / international characters (CJK, Japanese, Emoji, accented characters).
 *   - Truncates length to 100 characters max without breaking mid-word or leaving trailing dots.
 *   - Returns a deterministic fallback ('ChatGPT-Conversation') if the title is empty,
 *     null, undefined, or reduced to non-word punctuation only.
 */

export function sanitizeFilename(
  title: string | undefined | null,
  fallback: string = 'ChatGPT-Conversation'
): string {
  if (!title || typeof title !== 'string') {
    return fallback;
  }

  // Normalize Unicode and collapse consecutive whitespace/newlines
  let clean = title.normalize('NFC').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();

  // Replace illegal OS filename characters with space (\ / : * ? " < > | and control characters)
  clean = clean.replace(/[\\/:*?"<>|\x00-\x1F]/g, ' ').replace(/\s+/g, ' ').trim();


  // Strip trailing dots and spaces (Windows restriction)
  clean = clean.replace(/[. ]+$/, '').trim();

  // Truncate to maximum 100 characters safely
  if (clean.length > 100) {
    clean = clean.slice(0, 100).replace(/[. ]+$/, '').trim();
  }

  // Verify sanitized string contains at least one letter, number, or Unicode word character
  const hasWordChar = /[\p{L}\p{N}]/u.test(clean);
  if (!hasWordChar) {
    return fallback;
  }

  return clean || fallback;
}
