/** Both states share avatar nodes, so CSS can interpolate their positions. */
export function avatarStackLayout(count: number, width: number, size: number, overlap: number, gap: number, expanded: boolean) {
  const columns = Math.max(1, Math.floor((width + gap) / (size + gap)));
  const rows = expanded ? Math.ceil(count / columns) : Math.min(count, 1);
  return {
    width: expanded ? Math.max(width, size) : Math.max(width, count ? size + (count - 1) * (size - overlap) : 0),
    height: rows ? rows * size + (rows - 1) * gap : 0,
    positions: Array.from({ length: count }, (_, index) => ({
      x: expanded ? (index % columns) * (size + gap) : index * (size - overlap),
      y: expanded ? Math.floor(index / columns) * (size + gap) : 0,
    })),
  };
}
