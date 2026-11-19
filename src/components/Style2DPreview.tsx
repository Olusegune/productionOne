import type { StyleBible } from "../domain/visualDevelopment";
import { FAMILIES_2D } from "../domain/style2d";

/** Line weight read from the preset's own line description, so the swatch changes with the settings. */
function strokeFor(line: string): number {
  if (/^no (outline|line)|no line:|^none/i.test(line) || /no outline/i.test(line.slice(0, 40))) return 0;
  if (/\b(thick|bold|heavy|chunky)\b/i.test(line)) return 4.5;
  if (/\b(fine|thin|hairline)\b/i.test(line)) return 1.2;
  return 2.6;
}

/**
 * A small drawing made from a 2D preset's settings (palette, line weight, texture, pixel or halftone look). It shows the style's ingredients; it is NOT an example picture made by an image model, and the caption says so.
 */
export function Style2DPreview({ style, size = 120 }: { style: StyleBible; size?: number }) {
  const spec = style.spec2d;
  if (!spec) return null;
  const [ink, a, b, paper] = style.palette.length >= 4 ? style.palette : ["#222", "#d77", "#7ad", "#eee"];
  const pixel = spec.family2d === FAMILIES_2D.pixel;
  const halftone = /halftone|screentone/i.test(`${spec.shading} ${spec.texture}`);
  const stroke = strokeFor(spec.line);
  const id = spec.id.replace(/[^a-z0-9]/gi, "");
  return (
    <svg className="s2d-preview" width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={`${style.name}: a schematic swatch drawn from this style's settings, not a generated picture`}>
      <defs>
        <pattern id={`dots-${id}`} width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1.1" fill={ink} opacity=".55" /></pattern>
        <pattern id={`grain-${id}`} width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 5 L6 1 M0 2 L3 0" stroke={ink} strokeWidth=".6" opacity=".22" /></pattern>
      </defs>
      <rect width="120" height="120" fill={paper} />
      {pixel ? (
        <g shapeRendering="crispEdges">
          {[[48, 20, 24, 8], [44, 28, 32, 24], [48, 52, 24, 8], [40, 60, 40, 28], [40, 88, 16, 16], [64, 88, 16, 16]].map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} fill={i < 3 ? a : b} />)}
          {[[52, 36, 8, 8], [64, 36, 8, 8]].map(([x, y, w, h], i) => <rect key={`e${i}`} x={x} y={y} width={w} height={h} fill={ink} />)}
        </g>
      ) : (
        <g stroke={stroke ? ink : "none"} strokeWidth={stroke} strokeLinejoin="round">
          <ellipse cx="60" cy="36" rx="17" ry="18" fill={a} />
          <path d="M34 106 C34 70 44 56 60 56 C76 56 86 70 86 106 Z" fill={b} />
          <path d="M60 56 C76 56 86 70 86 106 L66 106 C72 84 70 66 60 56 Z" fill={ink} opacity=".28" stroke="none" />
          <circle cx="54" cy="35" r="2.2" fill={ink} stroke="none" /><circle cx="66" cy="35" r="2.2" fill={ink} stroke="none" />
        </g>
      )}
      {halftone && <rect width="120" height="120" fill={`url(#dots-${id})`} opacity=".5" />}
      {spec.intentionalTexture && !pixel && <rect width="120" height="120" fill={`url(#grain-${id})`} />}
    </svg>
  );
}
