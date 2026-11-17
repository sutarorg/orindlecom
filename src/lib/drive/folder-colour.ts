/**
 * Folder colours.
 *
 * One palette, defined once. These four pairs are the folder art used on the
 * marketing pages (the hero's CTA folder and the product mockups), so a folder in
 * the dashboard is the same object, in the same colours, as the folder on the
 * landing page. Two palettes that "look similar" drift apart; one that is imported
 * cannot.
 *
 * The colour is derived from the folder's id, not its position, so:
 *   - it is stable across reloads, sorting and renaming;
 *   - two folders side by side almost never share a colour;
 *   - uploading into a folder does not repaint it.
 *
 * "Almost never" is honest: four colours over many folders must repeat. Hashing
 * spreads them so that neighbours differ, which is what the eye is actually
 * judging — not that every folder in a hundred is unique.
 */

export interface FolderColour {
  /** Lighter stop, top-left. */
  from: string;
  /** Deeper stop, bottom-right. */
  to: string;
  /** Readable ink at this hue, for a label or an active state. */
  ink: string;
}

export const FOLDER_COLOURS: readonly FolderColour[] = [
  { from: "#7FB2FA", to: "#3B7DE8", ink: "#2A62B8" },
  { from: "#8CE3BE", to: "#38BD8B", ink: "#2A8F68" },
  { from: "#FFC078", to: "#FB8F3D", ink: "#B5651E" },
  { from: "#BCA6FD", to: "#8B5CF6", ink: "#6D3FCE" },
] as const;

/**
 * FNV-1a over the id.
 *
 * Chosen over summing characters because ids are UUIDs: a sum of hex digits
 * clusters hard on a handful of values and would paint a whole folder list two
 * colours. FNV-1a disperses adjacent inputs, which is the property that matters
 * when ids differ by one character.
 */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function folderColour(id: string): FolderColour {
  return FOLDER_COLOURS[hash(id) % FOLDER_COLOURS.length];
}
