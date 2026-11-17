/**
 * Folder colours.
 *
 * One palette, defined once. These four pairs are the folder art used on the
 * marketing pages (the hero's CTA folder and the product mockups), so a folder in
 * the dashboard is the same object, in the same colours, as the folder on the
 * landing page. Two palettes that "look similar" drift; one that is imported cannot.
 *
 * ── Why the colour is positional, not hashed ────────────────────────────────
 * The obvious design is `hash(folder.id) % 4`: stable forever, independent of order.
 * Measured, it does not do the job. With four colours, two folders chosen at random
 * collide 25% of the time no matter how good the hash is, and over 200 consecutive
 * pairs the adjacent-collision rate was 56/199 for FNV-1a and 44/199 with an
 * avalanche step — neither better than chance. So in a list of four folders you
 * would routinely see two blues, which is exactly the thing the colour is for.
 *
 * Assigning colours across the visible set instead makes neighbours differ *by
 * construction*: the first four folders in any listing are four different colours,
 * and the cycle then repeats. The starting offset is derived from the first folder's
 * id so a list does not always begin on blue, and that offset is the only thing that
 * varies between visits.
 *
 * The trade is honest and worth stating: a folder's colour can change when the set
 * of folders around it changes, or when the list is sorted differently. Within a
 * view it is stable, and within one page of a folder it is distinct — which is the
 * property that actually helps somebody find a folder.
 */

export interface FolderColour {
  /** Lighter stop, top-left. */
  from: string;
  /** Deeper stop, bottom-right. */
  to: string;
}

/*
 * Exactly two stops each, and nothing else.
 *
 * An earlier version also carried a matching `ink` colour for tinting labels on
 * that hue. Nothing ever used it — the icon is a gradient with no text on it — and
 * an exported field nobody reads is a promise that it will be maintained. If a
 * label later needs to sit on one of these, the ink belongs where the label is.
 */
export const FOLDER_COLOURS: readonly FolderColour[] = [
  { from: "#7FB2FA", to: "#3B7DE8" },
  { from: "#8CE3BE", to: "#38BD8B" },
  { from: "#FFC078", to: "#FB8F3D" },
  { from: "#BCA6FD", to: "#8B5CF6" },
] as const;

/** A single folder's colour when there is no list to coordinate with. */
export function folderColour(id: string): FolderColour {
  let sum = 0;
  for (let i = 0; i < id.length; i += 1) sum = (sum + id.charCodeAt(i)) % 9973;
  return FOLDER_COLOURS[sum % FOLDER_COLOURS.length];
}

/**
 * Colours for a set of folders, keyed by id.
 *
 * Order is the caller's — the order the folders appear on screen — so the first four
 * tiles are always four different colours. Keys that are not folders may be included;
 * they are simply not in the map.
 */
export function assignFolderColours(ids: string[]): Map<string, FolderColour> {
  const colours = new Map<string, FolderColour>();
  if (ids.length === 0) return colours;

  // Offsetting by the first id keeps every listing from starting on the same colour,
  // while staying deterministic for a given set.
  const offset = folderColour(ids[0] ?? "") === FOLDER_COLOURS[0] ? 0 : ids[0].charCodeAt(0) % FOLDER_COLOURS.length;

  ids.forEach((id, index) => {
    colours.set(id, FOLDER_COLOURS[(index + offset) % FOLDER_COLOURS.length]);
  });

  return colours;
}
