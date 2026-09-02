/**
 * Small square legend swatch used by the Notices / Compliance accomplishment
 * panels. Extracted from four identical local `Dot` copies — same markup, same
 * classes, so rendering is unchanged.
 */
export function ColorDot({ color }: { color: string }) {
  return (
    <span
      className="mr-1.5 inline-block h-2 w-2 rounded-[2px] align-middle"
      style={{ background: color }}
    />
  );
}

export default ColorDot;
