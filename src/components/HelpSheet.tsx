import { useEffect, useRef } from "react";
import { BrandMark } from "./BrandMark";

export type HelpTopic = "start" | "docs" | "shortcuts" | "trouble" | "updates" | "about";

export const shortcuts: Array<[string, string]> = [
  ["Ctrl+N", "New project"],
  ["Ctrl+O", "Open a .pone or legacy .pguy project"],
  ["Ctrl+S", "Save"],
  ["Ctrl+Shift+S", "Save As (.pone)"],
  ["Ctrl+I", "Import a script"],
  ["Ctrl+E", "Export a production package"],
  ["Ctrl+W", "Close the project"],
  ["Ctrl+B", "Show or hide the sidebar"],
  ["Ctrl+= / Ctrl+-", "Zoom in / out"],
  ["Ctrl+0", "Actual size"],
  ["Ctrl+,", "Project settings"],
  ["F11", "Fullscreen"],
  ["F1", "Getting started"],
];

const copy: Record<HelpTopic, { title: string; body: React.ReactElement }> = {
  start: {
    title: "Getting started",
    body: (
      <>
        <p>Production One follows one path: <b>Create, Analyze, Design, Generate, Review, Deliver</b>. Direct (storyboards and animatics) is optional and never required.</p>
        <ol>
          <li>Story: paste or import a script, then press Analyze script.</li>
          <li>Design: approve a visual style, then create references for each character, set and prop.</li>
          <li>Review: approve each reference. Approved files become the production anchors.</li>
          <li>Deliver: the audit checks every asset has a verified file, then exports a package.</li>
        </ol>
        <p>The Golden Path card on Projects always shows what is done, what is missing and the next step.</p>
      </>
    ),
  },
  docs: {
    title: "Documentation",
    body: (
      <>
        <p><b>Projects</b> are saved as <code>.pone</code> files (File, Save As). Legacy Production Guy <code>.pguy</code> files open with File, Open and are never changed: saving writes a new <code>.pone</code>.</p>
        <p><b>Autosave</b> keeps a working copy in your app data after every change, so a crash does not lose work. Saving to a file is separate and clears the unsaved marker.</p>
        <p><b>Keys</b> for AI providers are stored only in the Windows Credential Manager. Generation that costs money always asks for a spending ceiling and a confirmation first.</p>
        <p>The full project notes live in <code>docs/PRODUCTION_ONE_PLAN.md</code> in the source folder.</p>
      </>
    ),
  },
  shortcuts: {
    title: "Keyboard shortcuts",
    body: (
      <table className="shortcut-table">
        <tbody>
          {shortcuts.map(([keys, action]) => (
            <tr key={keys}><th scope="row"><kbd>{keys}</kbd></th><td>{action}</td></tr>
          ))}
        </tbody>
      </table>
    ),
  },
  trouble: {
    title: "Troubleshooting",
    body: (
      <>
        <p><b>A project will not open.</b> Only <code>.pone</code> and legacy <code>.pguy</code> project files open. The message says what is wrong with the file.</p>
        <p><b>An API key was rejected.</b> Re-enter it in Tools, Provider Settings. Keys never appear in project files.</p>
        <p><b>Something looks wrong after a crash.</b> Reopen the app: the last autosaved state is restored. Your saved <code>.pone</code> files are untouched.</p>
        <p><b>Reset the view.</b> View, Reset Layout restores zoom and the sidebar.</p>
      </>
    ),
  },
  updates: {
    title: "Updates",
    body: (
      <p>Automatic updates are not set up in this build, so Production One cannot check for a newer version. Install new versions from the installer you were given. Nothing is downloaded in the background.</p>
    ),
  },
  about: {
    title: "About Production One",
    body: (
      <>
        <div className="about-mark"><BrandMark size={72} /></div>
        <p><b>Production One</b> {`0.10.0`}</p>
        <p>Your AI Production Department. A Windows studio for scripts, references, shots and production packages.</p>
        <p>Continues the Production Guy codebase; legacy Production Guy projects remain supported.</p>
      </>
    ),
  },
};

export function HelpSheet({ topic, onClose }: { topic: HelpTopic; onClose: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const { title, body } = copy[topic];
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="panel-heading">
          <h3>{title}</h3>
          <button ref={ref} className="secondary" onClick={onClose}>Close</button>
        </div>
        <div className="sheet-body">{body}</div>
      </section>
    </div>
  );
}
