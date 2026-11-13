import { useEffect, useId, useMemo, useRef, useState } from "react";
import { filterOptions, moveActive, type SelectOption } from "../domain/searchSelect";

/** A select you can type into: for long lists such as voices. WAI-ARIA combobox with a listbox popup; arrow keys, Enter, Escape and Home/End work. */
export function SearchSelect({ options, value, onChange, label, placeholder = "Type to search", emptyText = "Nothing matches" }: { options: SelectOption[]; value: string; onChange: (value: string) => void; label: string; placeholder?: string; emptyText?: string }) {
  const id = useId();
  const listId = `${id}-list`;
  const current = options.find((o) => o.value === value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const shown = useMemo(() => filterOptions(options, query), [options, query]);
  useEffect(() => { setActive(0); }, [query, open]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) { setOpen(false); setQuery(""); } };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);
  const pick = (o: SelectOption | undefined) => { if (!o) return; onChange(o.value); setOpen(false); setQuery(""); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (!open) setOpen(true); else setActive((a) => moveActive(a, 1, shown.length)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => moveActive(a, -1, shown.length)); }
    else if (e.key === "Home" && open) { e.preventDefault(); setActive(0); }
    else if (e.key === "End" && open) { e.preventDefault(); setActive(Math.max(0, shown.length - 1)); }
    else if (e.key === "Enter" && open) { e.preventDefault(); pick(shown[active]); }
    else if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); setQuery(""); }
  };
  return (
    <div className="search-select" ref={box}>
      <input
        role="combobox" aria-label={label} aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? `${id}-o${active}` : undefined}
        value={open ? query : current?.label ?? ""} placeholder={open ? placeholder : current ? undefined : placeholder}
        onFocus={() => setOpen(true)} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onKeyDown={onKey} autoComplete="off"
      />
      {open && (
        <ul id={listId} role="listbox" aria-label={label}>
          {shown.length === 0 && <li className="ss-empty" role="presentation">{emptyText}</li>}
          {shown.map((o, i) => (
            <li key={o.value} id={`${id}-o${i}`} role="option" aria-selected={o.value === value} className={i === active ? "active" : ""} onMouseDown={(e) => { e.preventDefault(); pick(o); }} onMouseEnter={() => setActive(i)}>{o.label}</li>
          ))}
        </ul>
      )}
      <span className="visually-hidden" role="status">{open ? `${shown.length} match${shown.length === 1 ? "" : "es"}` : ""}</span>
    </div>
  );
}
