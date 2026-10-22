/** The approved Production One application icon, so the title bar, About box and the Windows taskbar all show the same mark. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return <img src="/app-icon.png" width={size} height={size} alt="Production One" style={{ display: "block", objectFit: "contain" }} />;
}
