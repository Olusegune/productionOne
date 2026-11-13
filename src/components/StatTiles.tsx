import { Clapperboard, Users, Box, Mountain, BadgeCheck } from "lucide-react";

/** The project at a glance: five icon tiles instead of a sentence of numbers. */
export function StatTiles({ scenes, characters, props, sets, approved, total }: { scenes: number; characters: number; props: number; sets: number; approved: number; total: number }) {
  const tiles = [
    { icon: Clapperboard, label: scenes === 1 ? "Scene" : "Scenes", value: String(scenes), tone: "scene" },
    { icon: Users, label: characters === 1 ? "Character" : "Characters", value: String(characters), tone: "character" },
    { icon: Box, label: props === 1 ? "Prop" : "Props", value: String(props), tone: "prop" },
    { icon: Mountain, label: sets === 1 ? "Set" : "Sets", value: String(sets), tone: "set" },
    { icon: BadgeCheck, label: "Approved", value: `${approved}/${total}`, tone: "approved" },
  ];
  return (
    <ul className="stat-tiles" aria-label="Project at a glance">
      {tiles.map(({ icon: Icon, label, value, tone }) => (
        <li key={label} className={`tone-${tone}`}><span className="stat-icon"><Icon size={18} aria-hidden="true" /></span><b>{value}</b><small>{label}</small></li>
      ))}
    </ul>
  );
}
