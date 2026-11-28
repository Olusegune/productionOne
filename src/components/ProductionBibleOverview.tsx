import { BookOpen, Link2, Lock, Palette, Shapes, TriangleAlert, Users, CircleCheck } from "lucide-react";
import type { BibleOverview } from "../domain/bibleGroups";

/** One calm page for everything that ties the bible together. It reads the records and changes nothing. */
export function ProductionBibleOverview({ overview, onGroup }: { overview: BibleOverview; onGroup: (group: "characters" | "assets" | "worlds") => void }) {
  const o = overview;
  const line = (label: string, c: { total: number; approved: number }, group: "characters" | "assets" | "worlds") => (
    <li key={group}><button onClick={() => onGroup(group)}><b>{label}</b> <span>{c.total === 0 ? "none yet" : `${c.approved} of ${c.total} approved`}</span></button></li>
  );
  const quiet = o.attention.length === 0 && o.relationships.needLook.length === 0 && o.relationships.conflicts.length === 0;
  return (
    <section className="panel bible-overview" aria-label="Production bible overview">
      <header className="wd-head"><div><h2><BookOpen size={18} aria-hidden="true" /> Production bible</h2><p className="helper">The whole production at a glance. Pick a group on the left to work on its pieces.</p></div></header>

      <div className="bo-grid">
        <div className="wd-design"><h3><Palette size={16} color="var(--hue-design)" aria-hidden="true" />Art style</h3><p>{o.style}</p></div>
        <div className="wd-design"><h3><Shapes size={16} color="var(--hue-asset)" aria-hidden="true" />What you have</h3><ul className="bo-list">{line("Characters", o.counts.characters, "characters")}{line("Assets (costumes and props)", o.counts.assets, "assets")}{line("Worlds (sets and places)", o.counts.worlds, "worlds")}</ul></div>

        <div className="wd-design">
          <h3><Users size={16} color="var(--hue-character)" aria-hidden="true" />Species and factions</h3>
          {o.profiles.length === 0 ? <p className="helper">None yet. Start one from a character's Anatomy tab.</p> : <ul>{o.profiles.map((p, i) => <li key={i}><b>{p.name}</b> <small>({p.level})</small>: {p.members.length ? p.members.join(", ") : "no members yet"}</li>)}</ul>}
        </div>

        <div className="wd-design">
          <h3><Link2 size={16} color="var(--hue-link)" aria-hidden="true" />Relationships</h3>
          <p>{o.relationships.total === 0 ? "None recorded yet." : `${o.relationships.approved} approved of ${o.relationships.total}.`}</p>
          {o.relationships.conflicts.length > 0 && <ul className="wd-why" role="alert">{o.relationships.conflicts.map((c, i) => <li key={i}>{c}</li>)}</ul>}
          {o.relationships.needLook.length > 0 && <><p className="helper">Need a look because something they depend on changed:</p><ul>{o.relationships.needLook.map((n, i) => <li key={i}>{n}</li>)}</ul></>}
        </div>

        <div className="wd-design">
          <h3><Lock size={16} color="var(--hue-lock)" aria-hidden="true" />Frozen scenes</h3>
          <p>{o.frozen.snapshots === 0 ? "No scene has been frozen yet." : `${o.frozen.scenes} scene${o.frozen.scenes === 1 ? "" : "s"}, ${o.frozen.snapshots} frozen version${o.frozen.snapshots === 1 ? "" : "s"}, ${o.frozen.branches} branch${o.frozen.branches === 1 ? "" : "es"}.`}</p>
        </div>

        <div className="wd-design">
          <h3>{quiet ? <CircleCheck size={16} color="var(--hue-ok)" aria-hidden="true" /> : <TriangleAlert size={16} color="var(--hue-warn)" aria-hidden="true" />}Needs attention</h3>
          {quiet ? <p className="helper">Nothing is out of date. Everything approved still matches what it was made from.</p> : (
            <ul>{o.attention.map((a, i) => <li key={i}><b>{a.name}</b>: {a.action}</li>)}</ul>
          )}
        </div>
      </div>
    </section>
  );
}
