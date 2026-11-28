import { Anchor, ImageIcon, Link2, Lock, PackageCheck, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import type { Preflight } from "../domain/preflight";

/** Says what pressing the button will do, before it is pressed. Closed by default so it never gets in the way; the cost is always visible. */
export function PreflightCard({ plan }: { plan: Preflight }) {
  const row = (label: string, items: string[], k: string, Icon: LucideIcon) => (items.length ? <div className="pf-row" data-k={k}><b><Icon size={14} aria-hidden="true" />{label}</b><ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null);
  return (
    <details className="pf-card" aria-label="Before you press the button">
      <summary><ShieldCheck size={15} aria-hidden="true" /> Before you press the button · <span>{plan.cost}</span></summary>
      <div className="pf-body">
        {row("Will make", [plan.makes], "make", Sparkles)}
        {row("Kept recognisable", plan.protectedItems, "keep", Anchor)}
        {row("Left alone", [plan.untouched], "alone", Lock)}
        {row("Approved things this affects", plan.affects, "affects", Link2)}
        {row("Starts from", plan.uses, "uses", ImageIcon)}
        {row("You get", plan.deliverables, "get", PackageCheck)}
      </div>
    </details>
  );
}
