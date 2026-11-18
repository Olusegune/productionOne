import { assetIconFor } from "../domain/categoryIcons";

/** The icon for a kind of thing in the bible (character, costume, prop, set). Decorative: the word is always next to it. */
export function CategoryIcon({ type, size = 14 }: { type: string; size?: number }) {
  const Icon = assetIconFor(type);
  return <Icon className="cat-icon" size={size} aria-hidden="true" />;
}
