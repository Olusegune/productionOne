import { History, X } from "lucide-react";
import { recentName } from "../appHelpers";
import { Eyebrow } from "../components/Eyebrow";
import { FirstRun } from "../components/FirstRun";
import { GoldenPath } from "../components/GoldenPath";
import { ProjectHero } from "../components/ProjectHero";
import type { GoldenPathInput, GoldenStep } from "../domain/goldenPath";
import type { AnalysisResult } from "../domain/productionStudio";
import type { StyleBible } from "../domain/visualDevelopment";

/** The Projects workspace: project header, getting started, Golden Path and recent files. */
export function ProjectsView(props: {
  title: string;
  filePath: string | null | undefined;
  analysis: AnalysisResult;
  golden: GoldenPathInput;
  style: StyleBible;
  recents: string[];
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onOpenRecent: (path: string) => void;
  /** Takes one project off the list. The file is not deleted. */
  onForgetRecent: (path: string) => void;
  onClearRecents: () => void;
  onKeys: () => void;
  onWorkspace: (name: string) => void;
  onNext: (step: GoldenStep) => void;
}) {
  const { title, filePath, analysis, golden, recents } = props;
  const count = (...types: string[]) => analysis.assets.filter((a) => types.includes(a.type)).length;
  return (
    <section className="po-launch">
      <ProjectHero title={title} filePath={filePath} style={props.style} golden={golden} counts={{ scenes: analysis.scenes.length, characters: count("character"), props: count("prop"), sets: count("set", "environment") }} onNew={props.onNew} onOpen={props.onOpen} onSave={props.onSave} onContinue={props.onNext} onWorkspace={props.onWorkspace} />
      <FirstRun onKeys={props.onKeys} onStory={() => props.onWorkspace("Story")} />
      <GoldenPath input={golden} onGo={props.onWorkspace} onNext={props.onNext} />
      {recents.length > 0 && (
        <div className="recent-list">
          <div className="recent-head"><Eyebrow icon={History}>RECENT PROJECTS</Eyebrow><button className="tertiary recent-clear" onClick={props.onClearRecents} title="Empty this list. No project file is deleted.">Clear list</button></div>
          <ul>
            {recents.slice(0, 5).map((path) => (
              <li key={path}>
                <button className="recent-open" onClick={() => props.onOpenRecent(path)} title={path}>{recentName(path)}</button>
                <button className="icon-button recent-close" onClick={() => props.onForgetRecent(path)} aria-label={`Remove ${recentName(path)} from recent projects`} title="Remove from this list. The file is not deleted."><X size={13} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="helper kbd-hint"><kbd>Ctrl</kbd><kbd>K</kbd> Command palette: open any asset, import a script, save or export without leaving the keyboard. <span><kbd>Alt</kbd><kbd>1</kbd>–<kbd>5</kbd> switches workspace.</span></p>
    </section>
  );
}
