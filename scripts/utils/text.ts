/**
 * Removes Minecraft color codes from the beginning of a string.
 * Color codes are in the format §X where X is 0-9, a-f, k-o, or r.
 * @param text - The text to remove color codes from
 * @returns The text without leading color codes
 */
export function removeColorCode(text: string): string {
  return text.replace(/^§[0-9a-fk-or]/i, "");
}
