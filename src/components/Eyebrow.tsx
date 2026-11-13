import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** The small label above a heading, with an icon so each panel is recognisable at a glance. */
export function Eyebrow({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return <span className="eyebrow has-icon"><Icon size={14} aria-hidden="true" />{children}</span>;
}
