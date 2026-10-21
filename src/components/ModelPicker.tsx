import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, RefreshCw, Search } from "lucide-react";
import { localProviders, modelTakesReferences, providerLabels, providerOrder, type CatalogModel, type ProviderKey } from "../domain/imageCatalog";

/** One searchable list of every model from every provider. Pick any of them, or type your own id: nothing is hidden or locked. */
export function ModelPicker(props: {
  catalog: CatalogModel[];
  configured: Record<string, boolean>;
  provider: ProviderKey;
  modelId: string;
  onPick: (provider: ProviderKey, id: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const { catalog, configured, provider, modelId, onPick, onRefresh, refreshing } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [customProvider, setCustomProvider] = useState<ProviderKey>(provider);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const current = catalog.find((m) => m.provider === provider && m.id === modelId);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const away = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    const esc = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return providerOrder.map((p) => ({ p, items: catalog.filter((m) => m.provider === p && (!q || m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || providerLabels[p].toLowerCase().includes(q))) })).filter((g) => g.items.length);
  }, [catalog, query]);
  const pick = (p: ProviderKey, id: string) => { onPick(p, id); setOpen(false); setQuery(""); };
  const typed = query.trim();

  return (
    <div className="mp" ref={box}>
      <button className="mp-button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label="Choose image model">
        <span className="mp-name">{current?.name ?? modelId}</span>
        <span className="mp-sub">{providerLabels[provider]}{configured[provider] ? "" : localProviders.includes(provider) ? " · not running" : " · no key"}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="mp-pop" role="dialog" aria-label="Image models">
          <div className="mp-search">
            <Search size={15} />
            <input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${catalog.length} models, or paste any model id`} aria-label="Search models" />
            {onRefresh && <button className="mp-refresh" onClick={onRefresh} disabled={refreshing} title="Re-read the providers' model lists"><RefreshCw size={14} /> {refreshing ? "Reading…" : "Refresh"}</button>}
          </div>
          <div className="mp-list" role="listbox">
            {groups.map(({ p, items }) => (
              <section key={p}>
                <h5>{providerLabels[p]} <span>{items.length}</span>{!configured[p] && <em>{localProviders.includes(p) ? "not running" : "no key yet"}</em>}</h5>
                {items.map((m) => (
                  <button key={`${p}:${m.id}`} role="option" aria-selected={p === provider && m.id === modelId} className={`mp-item${p === provider && m.id === modelId ? " on" : ""}`} onClick={() => pick(p, m.id)}>
                    <span className="mp-item-name">{m.name}</span>
                    <small>{m.id}</small>
                    <span className="mp-tags">
                      {modelTakesReferences(p, m.id) && <i title="Can use your approved reference images">references</i>}
                      {m.source === "discovered" && <i className="new" title="Listed live by the provider">live list</i>}
                    </span>
                  </button>
                ))}
              </section>
            ))}
            {groups.length === 0 && <p className="mp-empty">No listed model matches “{typed}”.</p>}
          </div>
          <div className="mp-custom">
            <span>Use any model id</span>
            <select value={customProvider} onChange={(e) => setCustomProvider(e.target.value as ProviderKey)} aria-label="Provider for a custom model id">
              {providerOrder.map((p) => <option key={p} value={p}>{providerLabels[p]}</option>)}
            </select>
            <button className="secondary" disabled={!typed || /\s/.test(typed)} onClick={() => pick(customProvider, typed)}>{typed && !/\s/.test(typed) ? `Use “${typed.length > 28 ? typed.slice(0, 28) + "…" : typed}”` : "Type an id above"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
