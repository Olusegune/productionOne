import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** A friendly, illustrated empty state: layered colour glow, the icon, and a few drifting sparkles. Purely decorative art, real text. */
export function EmptyState({ icon: Icon, title, children, action, tone = "gold" }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode; tone?: "gold" | "blue" | "green" | "violet" }) {
  return (
    <div className={`empty-state tone-${tone}`}>
      <div className="empty-art" aria-hidden="true">
        <svg viewBox="0 0 120 120" width="112" height="112">
          <circle cx="60" cy="60" r="46" className="ring-outer" />
          <circle cx="60" cy="60" r="32" className="ring-inner" />
          <circle cx="98" cy="30" r="3" className="spark s1" />
          <circle cx="20" cy="42" r="2.2" className="spark s2" />
          <circle cx="92" cy="94" r="2.6" className="spark s3" />
          <path d="M24 88l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" className="spark s4" />
        </svg>
        <span className="empty-icon"><Icon size={30} /></span>
      </div>
      <h4>{title}</h4>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
