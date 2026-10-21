import type { ShotRecord } from "../domain/productionStudio";
import { angleLabels, sizeLabels } from "../domain/direct";

/** A schematic of the frame: thirds, safe areas, and where the subject sits for this size and screen direction. It is a planning aid, not a render. */
export function FramePreview({ shot, aspect = "16:9" }: { shot: ShotRecord; aspect?: string }) {
  const [aw, ah] = aspect.split(":").map(Number);
  const W = 320;
  const H = Math.round((W * ah) / aw);
  const size = shot.size ?? "MS";
  const scale = { EWS: 0.1, WS: 0.2, MWS: 0.38, MS: 0.55, MCU: 0.7, CU: 0.88, ECU: 1 }[size];
  const dir = shot.screenDir ?? "neutral";
  const cx = dir === "L>R" ? W / 3 : dir === "R>L" ? (2 * W) / 3 : W / 2;
  const subjectH = H * scale;
  const top = size === "ECU" ? 0 : Math.max(H * 0.08, H / 3 - subjectH * 0.18);
  const rect = (k: number) => ({ x: (W * (1 - k)) / 2, y: (H * (1 - k)) / 2, w: W * k, h: H * k });
  const act = rect(0.93);
  const title = rect(0.8);
  const tilt = shot.angle === "dutch" ? -8 : 0;
  return (
    <figure className="fp">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${sizeLabels[size]} framing guide`}>
        <rect x="0" y="0" width={W} height={H} rx="6" fill="#0d1013" />
        <g transform={`rotate(${tilt} ${W / 2} ${H / 2})`}>
          {[1, 2].map((i) => <line key={`v${i}`} x1={(W * i) / 3} y1="0" x2={(W * i) / 3} y2={H} stroke="rgba(255,255,255,.12)" />)}
          {[1, 2].map((i) => <line key={`h${i}`} x1="0" y1={(H * i) / 3} x2={W} y2={(H * i) / 3} stroke="rgba(255,255,255,.12)" />)}
          <rect x={act.x} y={act.y} width={act.w} height={act.h} fill="none" stroke="rgba(106,166,207,.45)" strokeDasharray="4 3" />
          <rect x={title.x} y={title.y} width={title.w} height={title.h} fill="none" stroke="rgba(217,189,134,.5)" strokeDasharray="4 3" />
          {shot.assetIds.length > 0 && size !== "EWS" && (
            <g>
              <ellipse cx={cx} cy={top + subjectH * 0.2} rx={Math.max(5, subjectH * 0.13)} ry={Math.max(6, subjectH * 0.16)} fill="rgba(217,189,134,.85)" />
              <rect x={cx - Math.max(8, subjectH * 0.2)} y={top + subjectH * 0.36} width={Math.max(16, subjectH * 0.4)} height={Math.max(8, subjectH * 0.64)} rx="6" fill="rgba(217,189,134,.4)" />
            </g>
          )}
          {size === "EWS" && <ellipse cx={cx} cy={H * 0.66} rx="4" ry="6" fill="rgba(217,189,134,.85)" />}
          {dir !== "neutral" && (
            <path d={dir === "L>R" ? `M ${cx + 22} ${H / 2} l 18 0 m -6 -5 l 6 5 l -6 5` : `M ${cx - 22} ${H / 2} l -18 0 m 6 -5 l -6 5 l 6 5`} stroke="rgba(255,255,255,.7)" fill="none" strokeWidth="2" strokeLinecap="round" />
          )}
        </g>
      </svg>
      <figcaption>{sizeLabels[size]} · {angleLabels[shot.angle ?? "eye-level"]} · {shot.lens ?? 40}mm{dir !== "neutral" ? ` · facing ${dir === "L>R" ? "right" : "left"}` : ""}</figcaption>
    </figure>
  );
}
