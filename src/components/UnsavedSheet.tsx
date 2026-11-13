import { useEffect, useRef } from "react";
import { Save } from "lucide-react";

export function UnsavedSheet({
  title,
  onSave,
  onDiscard,
  onCancel,
}: {
  title: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="sheet" role="alertdialog" aria-modal="true" aria-label="Unsaved changes">
        <h3 className="with-icon"><Save size={20} aria-hidden="true" />Save changes to {title}?</h3>
        <p className="helper">Your work is autosaved in the app, but it is not in a project file yet.</p>
        <div className="button-row sheet-actions">
          <button ref={ref} className="primary" onClick={onSave}>Save</button>
          <button className="secondary" onClick={onDiscard}>Don't save</button>
          <button className="secondary" onClick={onCancel}>Cancel</button>
        </div>
      </section>
    </div>
  );
}
