import { ShieldCheck } from "lucide-react";
import type { Preflight } from "../domain/preflight";

/** Says what pressing the button will do, before it is pressed. Closed by default so it never gets in the way; the cost is always visible. */
export function PreflightCard({ plan }: { plan: Preflight }) {
  const row = (label: string, items: string[]) => (items.length ? <div className="pf-row"><b>{label}</b><ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null);
  return (
    <details className="pf-card" aria-label="Before you press the button">
      <summary><ShieldCheck size={15} aria-hidden="true" /> Before you press the button · <span>{plan.cost}</span></summary>
      <div className="pf-body">
        {row("Will make", [plan.makes])}
        {row("Kept recognisable", plan.protectedItems)}
        {row("Left alone", [plan.untouched])}
        {row("Approved things this affects", plan.affects)}
        {row("Starts from", plan.uses)}
        {row("You get", plan.deliverables)}
      </div>
    </details>
  );
}
