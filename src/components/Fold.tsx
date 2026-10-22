import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/** One collapsible group of controls. Remembers nothing: the caller decides what starts open. */
export function Fold(props: { title: string; hint?: string; defaultOpen?: boolean; children: ReactNode; id?: string }) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  return (
    <section className={`fold${open ? " open" : ""}`} data-fold={props.id ?? props.title}>
      <button className="fold-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <ChevronRight size={15} />
        <span>{props.title}</span>
        {props.hint && <small>{props.hint}</small>}
      </button>
      {open && <div className="fold-body">{props.children}</div>}
    </section>
  );
}
