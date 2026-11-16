import { toggleTheme } from "./data/theme";
import { useLook, useProjectAccent } from "./data/appearance";
import { looks } from "./domain/appearance";
import { AppearanceMenu } from "./components/AppearanceMenu";
import { addCharacterAsset, addPropAsset, applyReadAge } from "./domain/readingActions";
import { hasWork, needsBackup } from "./domain/projectSafety";
import { workspaceShortcut } from "./domain/shortcuts";
import { isTauri, initialShot,  downloadJson, downloadText } from "./appHelpers";
import { Eyebrow } from "./components/Eyebrow";
import { DesignView } from "./views/DesignView";
import { DirectView } from "./views/DirectView";
import { ProjectsView } from "./views/ProjectsView";
import { StoryView } from "./views/StoryView";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { DeliveryCenter } from "./components/DeliveryCenter";
import { convertScript, type ScriptKind } from "./engine/importers";
import { 
  Check,
  Clapperboard, 
  Globe, 
  KeyRound,
  Settings2,
  FolderKanban,
  PackageCheck, 
  PenTool, 
  Sparkles, 
} from "lucide-react";
import { projectStore, studioStore, type StudioState } from "./data/projectStore";
import { demoGraph } from "./domain/demoGraph";
import {
  dependentsOf,
  reviseNode,
  synchronizeProductionGraph,
  type ProductionGraph,
} from "./domain/productionGraph";
import {
  advanceQueue,
  analyzeScript,
  mergeAnalysis,
  titleFromScript,
  animaticDuration, 
  compileAssetPrompt,
  compileShotPackage,
  coverageAudit,
  normalizeShotOrder, 
  sceneCoverageAudit,
  shotAtTime,
  type AnalysisResult,
  type GenerationJob,
  type PromptPackage,
  type ShotRecord,
  type VideoModel,
  videoPresets,
} from "./domain/productionStudio";
import { providerRegistry, type ProviderId } from "./domain/providerRegistry";
import { labelLines } from "./domain/qualityEngine";
import {
  defaultStyleBible,
  planAssetSheets,
  recommendModels,
  type SheetType,
  type StyleBible,
} from "./domain/visualDevelopment";
import "./styles.css";
import "./studio.css";
import "./providers.css";
import "./animatic.css";
import "./art-direction.css";
import "./inventory.css";
import "./production-one.css";
import "./studio-shell.css";
import "./theme.css";
import "./director.css";
import "./delivery.css";
import "./cleanrender.css";
import "./shell-v2.css";
import "./review.css";
import "./gallery.css";
import "./script.css";
import { sampleStory } from "./engine/sampleStory";
import { LocalAiPanel } from "./components/LocalAiPanel";
import { useLocalAi } from "./data/localAi";
import { anyLocal } from "./domain/localAi";
import type { DemoClip } from "./domain/demoClips";
import { AssetInspector, BibleTree } from "./components/bible";
import { CommandPalette, QueueDock, TopBar, type PaletteCommand } from "./components/shell";
import { useImageQueue } from "./data/useImageQueue";
import { addSupplied, dropMissing, emptyQueue, recover, type ImageJob, type QueueState } from "./domain/generationQueue";
import { dropMissingRefs, flagMissingClips, reconcileMissing, reconcileShots } from "./domain/missingFiles";
import { HelpSheet, type HelpTopic } from "./components/HelpSheet";
import { UnsavedSheet } from "./components/UnsavedSheet";
import { goldenPath, type GoldenPathInput, type GoldenStep } from "./domain/goldenPath";
import { ReviewView } from "./views/ReviewView";
import { buildProjectFile, parseProjectFile, suggestedFileName, type ProjectFile } from "./data/projectFile";

const workspaces = [
  { name: "Projects", icon: FolderKanban },
  { name: "Story", icon: PenTool },
  { name: "Design", icon: Sparkles },
  { name: "Direct", icon: Clapperboard, optional: true },
  { name: "Deliver", icon: PackageCheck },
];
const sampleScript = sampleStory;


export default function App() {
  const [workspace, setWorkspace] = useState("Projects"),
    [graph, setGraph] = useState<ProductionGraph>(() =>
      structuredClone(demoGraph),
    ),
    [hydrated, setHydrated] = useState(false);
  const [script, setScript] = useState(sampleScript),
    [analysis, setAnalysis] = useState<AnalysisResult>(() =>
      analyzeScript(sampleScript),
    ),
    [shots, setShots] = useState<ShotRecord[]>([{ ...initialShot }]);
  const [selectedAsset, setSelectedAsset] = useState(0),
    [jobs, setJobs] = useState<GenerationJob[]>([]),
    [model, setModel] = useState<VideoModel>("Seedance 2.0"),
    [storyboardsEnabled, setStoryboardsEnabled] = useState(false),
    [notice, setNotice] = useState("");
  const [providersOpen, setProvidersOpen] = useState(false),
    [credentialProvider, setCredentialProvider] = useState<ProviderId>("kie"),
    [apiKey, setApiKey] = useState(""),
    [credentialError, setCredentialError] = useState("");
  const [credentialConfigured, setCredentialConfigured] = useState(false),
    [assetOutputs, setAssetOutputs] = useState<Record<string, string>>({});
  const [kieConfigured, setKieConfigured] = useState(false),
    [generationBudget, setGenerationBudget] = useState(""),
    [generationConfirmed, setGenerationConfirmed] = useState(false),
    [submittingGeneration, setSubmittingGeneration] = useState(false);
  const [selectedShot, setSelectedShot] = useState(0),
    [animaticPlaying, setAnimaticPlaying] = useState(false),
    [animaticTime, setAnimaticTime] = useState(0);
  const [styleBible, setStyleBible] = useState<StyleBible>(defaultStyleBible);
  const { look, setLook } = useLook();
  useProjectAccent(look, styleBible.palette);
  const [focusSheetType, setFocusSheetType] = useState<SheetType | undefined>();
  const [promptMode, setPromptMode] =
    useState<keyof PromptPackage>("universal");
  const [openAiConfigured, setOpenAiConfigured] = useState(false),
    [imageBudget, setImageBudget] = useState(""),
    [imageConfirmed, setImageConfirmed] = useState(false),
    [generatingImage, setGeneratingImage] = useState(false);
  const [title, setTitle] = useState("The Last Horizon"),
    [filePath, setFilePath] = useState<string | null>(null),
    [dirty, setDirty] = useState(false),
    [recents, setRecents] = useState<string[]>([]),
    [helpTopic, setHelpTopic] = useState<HelpTopic | null>(null),
    [pending, setPending] = useState<{ run: () => void } | null>(null),
    [zoom, setZoom] = useState(1),
    [sidebarHidden, setSidebarHidden] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false),
    [queue, setQueueState] = useState<QueueState>(emptyQueue),
    [paletteOpen, setPaletteOpen] = useState(false),
    [appearanceOpen, setAppearanceOpen] = useState(false),
    [localOpen, setLocalOpen] = useState(false),
    [clips, setClipsState] = useState<DemoClip[]>([]),
    [assetRefs, setAssetRefsState] = useState<Record<string, string[]>>({}),
    [sheetNotes, setSheetNotes] = useState<Record<string, string>>({}),
    [sheetSettings, setSheetSettings] = useState<Record<string, string>>({});
  const setAssetRefs = (update: (r: Record<string, string[]>) => Record<string, string[]>) => setAssetRefsState(update);
  const setClips = (update: (c: DemoClip[]) => DemoClip[]) => setClipsState(update);
  const localAi = useLocalAi(isTauri);
  const scriptArea = useRef<HTMLTextAreaElement>(null),
    studioControl = useRef<{ generateFirst: () => void } | null>(null);
  const setQueue = (update: (q: QueueState) => QueueState) => setQueueState(update);
  const snapshot = useRef<string | null>(null),
    scriptInput = useRef<HTMLInputElement>(null),
    projectInput = useRef<HTMLInputElement>(null),
    actionsRef = useRef<Record<string, () => void>>({}),
    guardRef = useRef<(run: () => void) => void>(() => {}),
    openPathRef = useRef<(path: string) => void>(() => {}),
    prevStep = useRef<{ id: string; index: number } | null>(null);
  const audit = useMemo(
    () =>
      coverageAudit(
        analysis.assets,
        storyboardsEnabled ? shots : [],
        Object.keys(assetOutputs),
      ),
    [analysis, shots, storyboardsEnabled, assetOutputs],
  );
  const studioNow: StudioState = useMemo(
    () => ({ script, analysis, shots, jobs, storyboardsEnabled, model, assetOutputs, styleBible, title, queue, clips, assetRefs, sheetNotes, sheetSettings }),
    [script, analysis, shots, jobs, storyboardsEnabled, model, assetOutputs, styleBible, title, queue, clips, assetRefs, sheetNotes, sheetSettings],
  );
  const goldenInput: GoldenPathInput = {
    hasScript: script.trim().length > 0,
    assetCount: analysis.assets.length,
    styleLocked: styleBible.locked,
    outputsCount: analysis.assets.filter((a) => assetOutputs[a.id]).length,
    approvedCount: analysis.assets.filter((a) => a.status === "approved").length,
    jobsActive:
      jobs.filter((j) => j.status === "queued" || j.status === "running").length +
      queue.jobs.filter((j) => j.status === "queued" || j.status === "generating" || j.status === "validating").length,
    storyboards: storyboardsEnabled,
    shotCount: shots.length,
    ready: audit.ready,
  };
  const sceneCoverage = useMemo(
    () =>
      sceneCoverageAudit(
        analysis,
        storyboardsEnabled ? shots : [],
        Object.keys(assetOutputs),
      ),
    [analysis, shots, storyboardsEnabled, assetOutputs],
  );
  const activeShot =
    shots[Math.min(selectedShot, Math.max(0, shots.length - 1))] ?? initialShot;
  const compiled = useMemo(
    () =>
      compileShotPackage(
        activeShot,
        model,
        analysis.assets.map((a) => a.id),
      ),
    [activeShot, model, analysis],
  );
  const totalAnimaticDuration = useMemo(() => animaticDuration(shots), [shots]);
  const plannedSheets = useMemo(
    () => planAssetSheets(analysis.assets, analysis.scenes, analysis.story),
    [analysis],
  );
  const modelRecommendations = useMemo(
    () =>
      analysis.assets[selectedAsset]
        ? recommendModels(analysis.assets[selectedAsset], "Turnaround")
        : [],
    [analysis.assets, selectedAsset],
  );
  const activePromptPackage = useMemo(
    () =>
      analysis.assets[selectedAsset]
        ? compileAssetPrompt(
            analysis.assets[selectedAsset],
            `${styleBible.description} ${styleBible.materials}. ${styleBible.rendering}. ${styleBible.lighting}.`,
          )
        : null,
    [analysis.assets, selectedAsset, styleBible],
  );
  useEffect(() => {
    if ("__TAURI_INTERNALS__" in window) import("@tauri-apps/api/core").then(({ invoke }) => invoke("app_ready")).catch(() => {});
  }, []);
  useEffect(() => {
    Promise.all([projectStore.load(), studioStore.load()]).then(
      ([savedGraph, studio]) => {
        setGraph(savedGraph);
        if (studio) {
          setTitle(studio.title ?? "The Last Horizon");
          setQueueState(recover(studio.queue ?? emptyQueue()));
          setClipsState(studio.clips ?? []);
          setAssetRefsState(studio.assetRefs ?? {});
          setSheetNotes(studio.sheetNotes ?? {});
          setSheetSettings(studio.sheetSettings ?? {});
          setScript(studio.script);
          setAnalysis(studio.analysis);
          setShots(studio.shots);
          setJobs(studio.jobs);
          setStoryboardsEnabled(studio.storyboardsEnabled);
          setModel(studio.model);
          setAssetOutputs(studio.assetOutputs ?? {});
          setStyleBible(studio.styleBible ?? defaultStyleBible);
        }
        setHydrated(true);
      },
    );
  }, []);
  useEffect(() => {
    if (hydrated) {
      void projectStore.save(graph);
      void studioStore.save(studioNow);
    }
  }, [graph, studioNow, hydrated]);
  const studioKey = useMemo(() => JSON.stringify(studioNow), [studioNow]);
  useEffect(() => {
    if (!hydrated) return;
    if (snapshot.current === null) snapshot.current = studioKey;
    const changed = snapshot.current !== studioKey;
    setDirty(changed);
    if (isTauri) void import("@tauri-apps/api/core").then(({ invoke }) => invoke("set_dirty", { dirty: changed })).catch(() => {});
  }, [studioKey, hydrated]);
  useEffect(() => {
    const name = `${dirty ? "\u2022 " : ""}${title} \u2014 Production One`;
    document.title = name;
    if (isTauri) void import("@tauri-apps/api/core").then(({ invoke }) => invoke("set_window_title", { title: name })).catch(() => {});
  }, [title, dirty]);
  useEffect(() => {
    if (!hydrated) return;
    setGraph((current) => {
      const next = synchronizeProductionGraph(
        current,
        analysis,
        shots,
        plannedSheets,
        assetOutputs,
        undefined,
        title,
      );
      return JSON.stringify(current) === JSON.stringify(next) ? current : next;
    });
  }, [analysis, shots, plannedSheets, assetOutputs, hydrated, title]);
  useEffect(() => {
    if (!providersOpen || !("__TAURI_INTERNALS__" in window)) {
      setCredentialConfigured(false);
      return;
    }
    import("@tauri-apps/api/core").then(({ invoke }) =>
      invoke<boolean>("credential_status", { provider: credentialProvider })
        .then(setCredentialConfigured)
        .catch(() => setCredentialConfigured(false)),
    );
  }, [providersOpen, credentialProvider]);
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) {
      setKieConfigured(false);
      return;
    }
    import("@tauri-apps/api/core").then(({ invoke }) =>
      invoke<boolean>("credential_status", { provider: "kie" })
        .then(setKieConfigured)
        .catch(() => setKieConfigured(false)),
    );
  }, [providersOpen, workspace]);
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) {
      setOpenAiConfigured(false);
      return;
    }
    import("@tauri-apps/api/core").then(({ invoke }) =>
      invoke<boolean>("credential_status", { provider: "openai" })
        .then(setOpenAiConfigured)
        .catch(() => setOpenAiConfigured(false)),
    );
  }, [providersOpen, workspace]);
  useEffect(() => {
    if (!animaticPlaying) return;
    const timer = window.setInterval(
      () =>
        setAnimaticTime((current) => {
          const next = current + 0.1;
          if (next >= totalAnimaticDuration) {
            setAnimaticPlaying(false);
            return 0;
          }
          const frame = shotAtTime(shots, next);
          if (frame) setSelectedShot(frame.index);
          return next;
        }),
      100,
    );
    return () => window.clearInterval(timer);
  }, [animaticPlaying, totalAnimaticDuration, shots]);
  const analyze = () => {
    const next = mergeAnalysis(analysis, analyzeScript(script));
    setAnalysis(next);
    const named = titleFromScript(title, next.story?.title);
    if (named) setTitle(named);
    setShots((current) =>
      current.map((shot, index) => ({
        ...shot,
        sceneId: next.scenes[index]?.id ?? next.scenes[0]?.id ?? shot.sceneId,
        assetIds: next.assets
          .filter((a) => a.sceneIds.includes(next.scenes[index]?.id ?? ""))
          .map((a) => a.id),
      })),
    );
    setNotice(
      `Found ${next.scenes.length} scenes and ${next.assets.length} production assets.`,
    );
  };
  const takeScript = (name: string, kind: ScriptKind, raw: string) => {
    let converted;
    try { converted = convertScript(kind, raw); } catch (e) { setNotice(e instanceof Error ? e.message : "That script could not be read."); return; }
    if (!converted.text.trim()) { setNotice(`${name} has no readable text.`); return; }
    setScript(converted.text);
    const next = analyzeScript(converted.text);
    setAnalysis(next);
    const named = titleFromScript(title, next.story?.title);
    if (named) setTitle(named);
    setNotice(`${name} imported: ${next.scenes.length} scenes and ${next.assets.length} assets.${converted.notes.length ? " " + converted.notes.join(" ") : ""}`);
  };
  const importScript = async (file: File) => {
    const ext = /\.([a-z]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? "";
    if (ext === "fdx") return takeScript(file.name, "fdx", await file.text());
    if (["txt", "md", "markdown", "fountain", "spmd", "screenplay"].includes(ext)) return takeScript(file.name, "text", await file.text());
    setNotice("Word and PDF scripts open from the desktop app. Here, use .txt, .md, .fountain or .fdx, or paste the text.");
  };
  const importScriptNative = async () => {
    if (!isTauri) { scriptInput.current?.click(); return; }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const picked = await invoke<{ name: string; kind: ScriptKind; text: string } | null>("pick_script_file");
      if (picked) takeScript(picked.name, picked.kind, picked.text);
    } catch (e) { setNotice(String(e)); }
  };
  const addNamedProp = (name: string) => {
    const result = addPropAsset(analysis.assets, name, analysis.scenes[0]?.id ?? "SCENE-001");
    if (!result.added) { setNotice(result.reason ?? "Nothing added."); return; }
    setAnalysis((current) => ({ ...current, assets: result.assets }));
    setNotice(`Added ${name.trim()} as a prop. Find it under Design.`);
  };
  const useAgeFromReading = (character: string, value: string) => {
    const result = applyReadAge(analysis.assets, character, value);
    if (!result.applied) { setNotice(`No character asset named ${character} to apply this to.`); return; }
    setAnalysis((current) => ({ ...current, assets: result.assets }));
    setNotice(`${character}'s age is now confirmed and goes into image prompts.`);
  };
  const addManualAsset = () => {
    const sceneId = analysis.scenes[0]?.id ?? "SCENE-001";
    const sequence = analysis.assets.length + 1;
    setAnalysis((current) => ({
      ...current,
      assets: [
        ...current.assets,
        {
          id: `MANU-ASSET-${String(sequence).padStart(3, "0")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
          name: "New production asset",
          type: "prop",
          sceneIds: [sceneId],
          status: "planned",
        },
      ],
    }));
  };
  /** Start a character from an image the person already has (for example a Midjourney render): it becomes the approved front view and every other sheet is built from it. */
  const addCharacterFromImage = async (name: string, gender = "") => {
    if (!isTauri) { setNotice("Adding a character from an image needs the desktop app."); return; }
    const result = addCharacterAsset(analysis.assets, name, analysis.scenes[0]?.id ?? "SCENE-001", Date.now(), gender);
    if (!result.added || !result.asset) { setNotice(result.reason ?? "Nothing added."); return; }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const chosen = await invoke<string[]>("pick_image_files", { multiple: false });
      if (!chosen.length) return;
      const [file] = await invoke<Array<{ path: string; inspection: { width: number; height: number } }>>("import_images", { paths: chosen });
      if (!file) return;
      const asset = result.asset;
      const out = addSupplied(queue, { assetId: asset.id, variant: "Canonical", sheetType: "Turnaround", viewKey: "front", label: "Front", aspect: "3:4", fullBody: true, path: file.path, width: file.inspection.width, height: file.inspection.height });
      setAnalysis((current) => ({ ...current, assets: result.assets }));
      setQueue(() => out.state);
      onSheetApproved(out.job, true);
      setSelectedAsset(result.assets.length - 1);
      setNotice(`${asset.name} added with your image as the approved front view. Open Reference sheets to build the turnaround, poses and expressions from it.`);
    } catch (error) { setNotice(String(error)); }
  };
  const approveAsset = (index: number) =>
    setAnalysis((current) => ({
      ...current,
      assets: current.assets.map((asset, i) =>
        i === index ? { ...asset, status: "approved" } : asset,
      ),
    }));
  const queueAsset = () => {
    const asset = analysis.assets[selectedAsset];
    if (!asset) return;
    setJobs((current) => [
      ...current,
      {
        id: `JOB-${String(current.length + 1).padStart(3, "0")}`,
        assetId: asset.id,
        provider: "External workflow",
        model: "Universal prompt",
        mode: "external",
        status: "queued",
        attempts: 0,
      },
    ]);
    setNotice(`${asset.name} added to the durable prompt queue.`);
  };
  const reviseSelectedAsset = () => {
    const asset = analysis.assets[selectedAsset];
    if (!asset) return;
    const affected = dependentsOf(graph, asset.id);
    setGraph((current) => reviseNode(current, asset.id));
    setJobs((current) => [
      ...current,
      {
        id: `JOB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        assetId: asset.id,
        provider: "External workflow",
        model: "Universal prompt",
        mode: "external",
        status: "queued",
        attempts: 0,
      },
    ]);
    setNotice(
      `${asset.name} revision opened. ${affected.length} dependent graph record${affected.length === 1 ? "" : "s"} marked stale; only this asset was queued.`,
    );
  };
  const runQueue = async () => {
    const next = advanceQueue(jobs, ["External workflow"]);
    const job = next.find((item) => item.status === "running");
    setJobs(next);
    if (!job) return;
    const asset = analysis.assets.find((item) => item.id === job.assetId);
    if (!asset) {
      setJobs((current) =>
        current.map((item) =>
          item.id === job.id
            ? {
                ...item,
                status: "failed",
                error: "Asset record no longer exists",
              }
            : item,
        ),
      );
      return;
    }
    const prompt = compileAssetPrompt(
      asset,
      `${styleBible.description} ${styleBible.materials}. ${styleBible.rendering}. ${styleBible.lighting}.`,
    );
    try {
      let outputPath = `download:${asset.id}-prompt.json`;
      if ("__TAURI_INTERNALS__" in window) {
        const { invoke } = await import("@tauri-apps/api/core");
        outputPath = await invoke<string>("save_prompt_package", {
          assetId: asset.id,
          contents: JSON.stringify({ asset, styleBible, prompt }, null, 2),
        });
      } else
        downloadJson(`${asset.id}-prompt.json`, { asset, styleBible, prompt });
      setJobs((current) =>
        current.map((item) =>
          item.id === job.id
            ? { ...item, status: "complete", outputPath, error: undefined }
            : item,
        ),
      );
      setNotice(`${job.id} completed after its prompt package was written.`);
    } catch (error) {
      setJobs((current) =>
        current.map((item) =>
          item.id === job.id
            ? { ...item, status: "failed", error: String(error) }
            : item,
        ),
      );
      setNotice(`${job.id} failed: ${String(error)}`);
    }
  };
  const copyPrompt = async () => {
    if (!activePromptPackage) return;
    await navigator.clipboard.writeText(activePromptPackage[promptMode]);
    setNotice(`${promptMode} prompt copied as plain text.`);
  };
  const exportPrompt = (format: "txt" | "md" | "json" | "csv") => {
    const asset = analysis.assets[selectedAsset];
    if (!asset || !activePromptPackage) return;
    if (format === "json") {
      downloadJson(`${asset.id}-prompt.json`, {
        assetId: asset.id,
        assetName: asset.name,
        styleRevision: styleBible.revision,
        ...activePromptPackage,
      });
      return;
    }
    if (format === "csv") {
      const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
      downloadText(
        `${asset.id}-prompt.csv`,
        `asset_id,asset_name,mode,prompt\n${[asset.id, asset.name, promptMode, activePromptPackage[promptMode]].map(quote).join(",")}`,
        "text/csv",
      );
      return;
    }
    downloadText(
      `${asset.id}-prompt.${format}`,
      format === "md"
        ? `# ${asset.name} — ${promptMode}\n\n${activePromptPackage[promptMode]}\n`
        : activePromptPackage[promptMode],
    );
  };
  const exportAllPrompts = async () => {
    const entries = analysis.assets.flatMap((asset) => {
      const value = compileAssetPrompt(
        asset,
        `${styleBible.description} ${styleBible.materials}. ${styleBible.rendering}. ${styleBible.lighting}.`,
      );
      return Object.entries(value).map(([mode, prompt]) => ({
        name: `${asset.id}-${mode}.txt`,
        contents: prompt,
      }));
    });
    if (!("__TAURI_INTERNALS__" in window)) {
      downloadJson("all-prompts.json", { styleBible, entries });
      setNotice(
        "Browser preview exported all prompts as JSON. Windows builds create a ZIP.",
      );
      return;
    }
    const { invoke } = await import("@tauri-apps/api/core");
    const path = await invoke<string>("export_prompt_archive", {
      projectName: title,
      entries,
    });
    setNotice(`Prompt archive saved to ${path}`);
  };
  const patchShot = (
    field: keyof ShotRecord,
    value: string | number | string[],
  ) =>
    setShots((current) =>
      current.map((shot, index) =>
        index === selectedShot ? { ...shot, [field]: value } : shot,
      ),
    );
  const addShot = () => {
    setShots((current) => [
      ...current,
      {
        ...initialShot,
        id: `SHOT-${String(current.length + 1).padStart(3, "0")}`,
        order: current.length + 1,
        sceneId:
          analysis.scenes[Math.min(current.length, analysis.scenes.length - 1)]
            ?.id ?? initialShot.sceneId,
      },
    ]);
    setSelectedShot(shots.length);
  };
  const duplicateShot = () => {
    setShots((current) =>
      normalizeShotOrder([
        ...current.slice(0, selectedShot + 1),
        {
          ...activeShot,
          id: `SHOT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        },
        ...current.slice(selectedShot + 1),
      ]),
    );
    setSelectedShot((current) => current + 1);
  };
  const deleteShot = () => {
    if (shots.length === 1) {
      setNotice("A production must retain at least one shot.");
      return;
    }
    setShots((current) =>
      normalizeShotOrder(current.filter((_, index) => index !== selectedShot)),
    );
    setSelectedShot((current) =>
      Math.max(0, Math.min(current, shots.length - 2)),
    );
  };
  const moveShot = (direction: -1 | 1) => {
    const target = selectedShot + direction;
    if (target < 0 || target >= shots.length) return;
    setShots((current) => {
      const next = [...current];
      [next[selectedShot], next[target]] = [next[target], next[selectedShot]];
      return normalizeShotOrder(next);
    });
    setSelectedShot(target);
  };
  const saveCredential = async () => {
    if (!("__TAURI_INTERNALS__" in window)) {
      setNotice(
        "Credential storage is available in the Windows desktop build.",
      );
      return;
    }
    const { invoke } = await import("@tauri-apps/api/core");
    try {
      await invoke("save_credential", { provider: credentialProvider, apiKey });
    } catch (error) {
      setCredentialError(String(error));
      return;
    }
    setCredentialError("");
    setApiKey("");
    setCredentialConfigured(true);
    setNotice(
      `${providerRegistry.find((p) => p.id === credentialProvider)?.name} credential saved to Windows Credential Manager.`,
    );
  };
  const removeCredential = async () => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("delete_credential", { provider: credentialProvider });
    setCredentialConfigured(false);
    setNotice(
      `${providerRegistry.find((p) => p.id === credentialProvider)?.name} credential removed.`,
    );
  };
  const importAsset = async (file: File) => {
    const asset = analysis.assets[selectedAsset];
    if (!asset) return;
    if (!("__TAURI_INTERNALS__" in window)) {
      setNotice(
        "Native asset QA and labeling are available in the Windows build.",
      );
      return;
    }
    const { invoke } = await import("@tauri-apps/api/core");
    const imageData = Array.from(new Uint8Array(await file.arrayBuffer()));
    const record = {
      assetName: asset.name,
      assetId: asset.id,
      storyVariant: "Canonical",
      state: "Approved reference",
      sheetType: "Reference",
      view: "Hero",
      sceneReferences: asset.sceneIds,
      revision: 1,
      projectStyle: "Cinematic realism",
    };
    const result = await invoke<{
      path: string;
      inspection: {
        width: number;
        height: number;
        valid: boolean;
        warnings: string[];
      };
    }>("import_labeled_asset", {
      imageData,
      fileName: file.name,
      title: `${asset.id} ${asset.name}`,
      metadata: labelLines(record),
    });
    setAssetOutputs((current) => ({ ...current, [asset.id]: result.path }));
    if (result.inspection.valid) approveAsset(selectedAsset);
    setNotice(
      `${asset.name} imported, labeled, and checked at ${result.inspection.width}×${result.inspection.height}.`,
    );
  };
  const generateImageDirect = async () => {
    const asset = analysis.assets[selectedAsset];
    if (
      !asset ||
      !activePromptPackage ||
      !openAiConfigured
    )
      return;
    setGeneratingImage(true);
    const jobId = `JOB-${String(jobs.length + 1).padStart(3, "0")}`;
    setJobs((current) => [
      ...current,
      {
        id: jobId,
        assetId: asset.id,
        provider: "OpenAI",
        model: "gpt-image-1.5",
        mode: "direct",
        status: "running",
        attempts: 1,
      },
    ]);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const generated = await invoke<{
        path: string;
        inspection: { valid: boolean };
      }>("openai_generate_image", {
        model: "gpt-image-1.5",
        prompt: activePromptPackage.universal,
        size: "1024x1024",
        quality: "medium",
        outputName: `${asset.id}-generated`,
      });
      const labeledPath = generated.path.replace(/\.png$/i, "-labeled.png");
      const record = {
        assetName: asset.name,
        assetId: asset.id,
        storyVariant: "Canonical",
        state: "Generated reference",
        sheetType: "Identity",
        view: "Hero",
        sceneReferences: asset.sceneIds,
        revision: 1,
        projectStyle: styleBible.name,
      };
      const inspection = await invoke<{
        valid: boolean;
        width: number;
        height: number;
      }>("label_image", {
        inputPath: generated.path,
        outputPath: labeledPath,
        title: `${asset.id} ${asset.name}`,
        metadata: labelLines(record),
      });
      if (!inspection.valid)
        throw new Error("Generated image did not pass native QA");
      setAssetOutputs((current) => ({ ...current, [asset.id]: labeledPath }));
      approveAsset(selectedAsset);
      setJobs((current) =>
        current.map((item) =>
          item.id === jobId
            ? { ...item, status: "complete", outputPath: labeledPath }
            : item,
        ),
      );
      setImageConfirmed(false);
      setNotice(`${asset.name} generated, labeled, verified, and saved.`);
    } catch (error) {
      setJobs((current) =>
        current.map((item) =>
          item.id === jobId
            ? { ...item, status: "failed", error: String(error) }
            : item,
        ),
      );
      setNotice(`Image generation failed: ${String(error)}`);
    } finally {
      setGeneratingImage(false);
    }
  };
  const generateDirect = async () => {
    if (
      !kieConfigured ||
      model !== "Seedance 2.0"
    )
      return;
    setSubmittingGeneration(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const response = await invoke<Record<string, unknown>>(
        "kie_create_task",
        {
          model: videoPresets[model].apiModel,
          prompt: compiled.prompt,
          aspectRatio: "16:9",
          duration: [4, 5, 6, 8, 10, 12].reduce(
            (best, value) =>
              Math.abs(value - shots[0].duration) <
              Math.abs(best - shots[0].duration)
                ? value
                : best,
            5,
          ),
          generateAudio: videoPresets[model].supportsAudio,
        },
      );
      const data = (response.data ?? {}) as Record<string, unknown>;
      const taskId = String(data.taskId ?? response.taskId ?? "remote task");
      setJobs((current) => [
        ...current,
        {
          id: taskId,
          assetId: shots[0].id,
          provider: "KIE.ai",
          model: videoPresets[model].apiModel,
          mode: "direct",
          status: "running",
          attempts: 1,
        },
      ]);
      setNotice(`Direct Seedance task submitted: ${taskId}`);
      setGenerationConfirmed(false);
    } catch (error) {
      setNotice(`Direct generation was not submitted: ${String(error)}`);
    } finally {
      setSubmittingGeneration(false);
    }
  };
  const buildProductionZip = async () => {
    const packageManifest = {
      format: "production-one-package",
      version: 1,
      status: audit.ready ? "production-ready" : "draft-incomplete",
      project: title,
      analysis,
      plannedSheets,
      shots,
      jobs,
      audit,
      sceneCoverage,
      compiledAt: new Date().toISOString(),
    };
    if (!("__TAURI_INTERNALS__" in window)) {
      downloadJson("production-manifest.json", packageManifest);
      setNotice(
        "Browser preview exported the manifest. Windows builds create and validate the complete ZIP.",
      );
      return;
    }
    // Files can vanish while the app is open: look again right before the package is made, so "production-ready" is never claimed for pictures that are gone.
    {
      const { invoke: check } = await import("@tauri-apps/api/core");
      // Everything the project tracks is checked in one pass (so a later re-check has nothing new to say), but only approved pictures stop the package.
      const gone = await check<string[]>("missing_files", { paths: [...new Set(trackedPaths)] }).catch(() => [] as string[]);
      if (gone.length) {
        const dropped = dropMissing(queue, gone).dropped;
        if (dropped) setQueue((q) => dropMissing(q, gone).state);
        handleMissing(dropped, gone);
        const approvedGone = gone.filter((p) => Object.values(assetOutputs).includes(p));
        if (approvedGone.length) {
          setNotice(`No package was made: ${approvedGone.length} approved picture${approvedGone.length === 1 ? " is" : "s are"} not on this computer. The audit was updated. Remake or replace ${approvedGone.length === 1 ? "it" : "them"}, approve, then export again.`);
          return;
        }
      }
    }
    const quote = (value: unknown) => `"${String(value).replace(/"/g, '""')}"`;
    const ledger = [
      "asset_id,asset_name,type,status,scenes,reference_file",
      ...analysis.assets.map((asset) =>
        [
          asset.id,
          asset.name,
          asset.type,
          asset.status,
          asset.sceneIds.join("|"),
          assetOutputs[asset.id] ?? "",
        ]
          .map(quote)
          .join(","),
      ),
    ].join("\n");
    const { invoke } = await import("@tauri-apps/api/core");
    const path = await invoke<string>("export_production_package", {
      packageName: `${title || "production-one"}-${activeShot.id}`,
      manifest: JSON.stringify(packageManifest, null, 2),
      assetLedgerCsv: ledger,
      styleBible: JSON.stringify(styleBible, null, 2),
      modelUsage: JSON.stringify(
        {
          targetVideoModel: model,
          preset: videoPresets[model],
          imageRecommendations: modelRecommendations.map((item) => ({
            provider: item.provider,
            id: item.id,
            score: item.score,
            verifiedAt: item.verifiedAt,
          })),
        },
        null,
        2,
      ),
      prompt: compiled.prompt,
      referencePaths: Object.values(assetOutputs),
      exportMode: audit.ready ? "verified" : "draft",
    });
    setNotice(
      `Validated ${audit.ready ? "production-ready" : "draft"} package saved to ${path}`,
    );
  };
  const markSaved = () => {
    snapshot.current = studioKey;
    setDirty(false);
  };
  const refreshRecents = async () => {
    if (!isTauri) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      setRecents(await invoke<string[]>("recent_projects"));
    } catch { /* The list is a convenience; the app works without it. */ }
  };
  const forgetRecent = async (path: string) => {
    if (!isTauri) return;
    try { const { invoke } = await import("@tauri-apps/api/core"); setRecents(await invoke<string[]>("forget_recent_project", { path })); } catch { /* the list is a convenience */ }
  };
  const clearRecents = async () => {
    if (!isTauri) return;
    try { const { invoke } = await import("@tauri-apps/api/core"); setRecents(await invoke<string[]>("clear_recent_projects")); } catch { /* the list is a convenience */ }
  };
  const applyProject = (file: ProjectFile, path: string | null) => {
    const s = file.studio;
    snapshot.current = null;
    setTitle(file.title);
    setScript(s.script);
    setAnalysis(s.analysis);
    setShots(s.shots);
    setJobs(s.jobs);
    setStoryboardsEnabled(s.storyboardsEnabled);
    setModel(s.model);
    setAssetOutputs(s.assetOutputs ?? {});
    setStyleBible(s.styleBible ?? defaultStyleBible);
    setGraph(file.graph);
    setQueueState(recover(s.queue ?? emptyQueue()));
    setClipsState(s.clips ?? []);
    setAssetRefsState(s.assetRefs ?? {});
    setSheetNotes(s.sheetNotes ?? {});
    setSheetSettings(s.sheetSettings ?? {});
    setFilePath(path);
    setSelectedAsset(0);
    setSelectedShot(0);
    setDirty(false);
  };
  /**
   * New and Open replace the single autosave slot. If the open production has work that is not safely in a saved file, copy it to Documents\Production One\Backups first.
   * Returns the backup path, null when none was needed, or false when the backup failed (the caller then stops and nothing is replaced).
   */
  const keepCopy = async (): Promise<string | null | false> => {
    if (!isTauri || !needsBackup({ hasWork: hasWork({ script, analysis, queue }), filePath, dirty })) return null;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<string>("backup_project", { title, contents: JSON.stringify(buildProjectFile(title, graph, studioNow), null, 2) });
    } catch (error) {
      setNotice(`Could not keep a copy of "${title}", so nothing was replaced: ${String(error)}. Save it first, then try again.`);
      return false;
    }
  };
  const newProject = async () => {
    const kept = await keepCopy();
    if (kept === false) return;
    applyProject(
      buildProjectFile("Untitled production", { schemaVersion: 1, nodes: [], edges: [] }, {
        script: "", analysis: { scenes: [], assets: [] }, shots: [], jobs: [], storyboardsEnabled: false,
        model: "Seedance 2.0", assetOutputs: {}, styleBible: defaultStyleBible,
      }),
      null,
    );
    setWorkspace("Story");
    setNotice(`New production created. Paste or import your script to begin.${kept ? ` Your previous production was kept as a copy: ${kept}` : ""}`);
  };
  const openText = async (text: string, path: string | null) => {
    const parsed = parseProjectFile(text);
    if (!parsed.ok) { setNotice(parsed.error); return; }
    const kept = await keepCopy();
    if (kept === false) return;
    applyProject(parsed.file, parsed.legacy ? null : path);
    setWorkspace("Projects");
    setNotice(
      (parsed.legacy
        ? `Opened legacy Production Guy project "${parsed.file.title}". The original file is untouched; Save writes a new .pone.`
        : `Opened ${path ?? parsed.file.title}`) + (kept ? ` Your previous production was kept as a copy: ${kept}` : ""),
    );
  };
  const openProject = async () => {
    if (!isTauri) { projectInput.current?.click(); return; }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const opened = await invoke<{ path: string; contents: string } | null>("open_project_dialog");
      if (opened) { await openText(opened.contents, opened.path); void refreshRecents(); }
    } catch (error) { setNotice(`Could not open the project: ${String(error)}`); }
  };
  const openPath = async (path: string) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const opened = await invoke<{ path: string; contents: string }>("open_project_path", { path });
      await openText(opened.contents, opened.path);
      void refreshRecents();
    } catch (error) { setNotice(`Could not open the project: ${String(error)}`); }
  };
  const saveProject = async (forceDialog = false): Promise<boolean> => {
    const text = JSON.stringify(buildProjectFile(title, graph, studioNow), null, 2);
    if (!isTauri) {
      downloadText(suggestedFileName(title), text, "application/json");
      markSaved();
      setNotice(`Downloaded ${suggestedFileName(title)}.`);
      return true;
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const saved = filePath && !forceDialog
        ? await invoke<string>("save_project_path", { path: filePath, contents: text })
        : await invoke<string | null>("save_project_dialog", { suggested: suggestedFileName(title), contents: text });
      if (!saved) return false;
      setFilePath(saved);
      markSaved();
      void refreshRecents();
      setNotice(`Saved ${saved}`);
      return true;
    } catch (error) {
      setNotice(`Could not save the project: ${String(error)}`);
      return false;
    }
  };
  const guard = (run: () => void) => (dirty ? setPending({ run }) : run());
  const quit = async () => {
    if (!isTauri) { setNotice("Close this browser tab to exit."); return; }
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("quit_app");
  };
  guardRef.current = guard;
  openPathRef.current = (path) => void openPath(path);
  actionsRef.current = {
    "file-new": () => guard(() => void newProject()),
    "file-open": () => guard(() => void openProject()),
    "file-save": () => void saveProject(),
    "file-save-as": () => void saveProject(true),
    "file-import": () => { setWorkspace("Story"); void importScriptNative(); },
    "file-export": () => { setWorkspace("Deliver"); void buildProductionZip(); },
    "file-close": () => guard(() => void newProject()),
    "file-exit": () => guard(() => void quit()),
    "view-zoom-in": () => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2))),
    "view-zoom-out": () => setZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(2))),
    "view-zoom-reset": () => setZoom(1),
    "view-sidebar": () => setSidebarHidden((hidden) => !hidden),
    "view-reset-layout": () => { setZoom(1); setSidebarHidden(false); },
    "project-settings": () => setSettingsOpen(true),
    "project-inventory": () => setWorkspace("Story"),
    "project-audit": () => setWorkspace("Deliver"),
    "tools-models": () => setProvidersOpen(true),
    "tools-providers": () => setProvidersOpen(true),
    "tools-local": () => setLocalOpen(true),
    "tools-prompt": () => setWorkspace("Design"),
    "tools-queue": () => setWorkspace("Deliver"),
    "help-start": () => setHelpTopic("start"),
    "help-docs": () => setHelpTopic("docs"),
    "help-shortcuts": () => setHelpTopic("shortcuts"),
    "help-trouble": () => setHelpTopic("trouble"),
    "help-updates": () => setHelpTopic("updates"),
    "help-about": () => setHelpTopic("about"),
  };
  useEffect(() => {
    void refreshRecents();
    if (!isTauri) return;
    let dead = false;
    let offs: Array<() => void> = [];
    void import("@tauri-apps/api/event").then(async ({ listen }) => {
      const a = await listen<string>("menu-action", (e) => actionsRef.current[e.payload]?.());
      const b = await listen<string>("menu-open-recent", (e) => guardRef.current(() => openPathRef.current(e.payload)));
      const c = await listen("close-requested", () => actionsRef.current["file-exit"]?.());
      const d = await listen<string>("open-file", (e) => guardRef.current(() => openPathRef.current(e.payload)));
      if (dead) { a(); b(); c(); d(); } else offs = [a, b, c, d];
      // Started by double-clicking a project file: open it once the window is ready.
      const { invoke } = await import("@tauri-apps/api/core");
      const launched = await invoke<string | null>("launch_file").catch(() => null);
      if (launched && !dead) openPathRef.current(launched);
    });
    return () => { dead = true; offs.forEach((off) => off()); };
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen((open) => !open); }
      const jump = workspaceShortcut(event);
      if (jump) { event.preventDefault(); setWorkspace(jump); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const jumpToLine = (line: number) => {
    const area = scriptArea.current;
    if (!area) return;
    const lines = area.value.split("\n");
    const start = lines.slice(0, Math.max(0, line - 1)).reduce((n, l) => n + l.length + 1, 0);
    area.focus();
    area.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0));
    area.scrollTop = Math.max(0, (line - 4) * 20);
  };
  /** The Golden Path button does the step, not just a page change: on Generate it queues a first image and asks for the spending limit. */
  const goNext = (step: GoldenStep) => {
    setWorkspace(step.workspace);
    if (step.id === "generate") window.setTimeout(() => studioControl.current?.generateFirst(), 60);
  };
  const paletteCommands: PaletteCommand[] = [
    { id: "generate", label: "Generate a first image (test one)", hint: "Design", run: () => goNext({ id: "generate", label: "Generate", state: "active", detail: "", workspace: "Design", action: "" }) },
    ...["Projects", "Story", "Design", "Review", "Direct", "Deliver"].map((name) => ({ id: `go-${name}`, label: `Go to ${name}`, hint: "Workspace", run: () => setWorkspace(name) })),
    { id: "analyze", label: "Analyze the script", hint: "Story · free, local", run: () => { setWorkspace("Story"); analyze(); } },
    { id: "appearance", label: "Appearance: choose a look", hint: "View", run: () => setAppearanceOpen(true) },
    ...looks.map((l) => ({ id: `look-${l.id}`, label: `Appearance: ${l.name}`, hint: l.tagline, run: () => setLook(l.id) })),
    { id: "theme", label: "Switch between dark and light theme", hint: "View", run: () => setNotice(toggleTheme() === "light" ? "Light theme on. It is new, so tell me about anything hard to read." : "Dark theme on.") },
    { id: "new", label: "New project", hint: "File", run: () => actionsRef.current["file-new"]?.() },
    { id: "open", label: "Open a project…", hint: "File", run: () => actionsRef.current["file-open"]?.() },
    { id: "save", label: "Save project", hint: "File", run: () => actionsRef.current["file-save"]?.() },
    { id: "saveas", label: "Save project as…", hint: "File", run: () => actionsRef.current["file-save-as"]?.() },
    { id: "import", label: "Import a script…", hint: "File", run: () => actionsRef.current["file-import"]?.() },
    { id: "export", label: "Export the production package", hint: "Deliver", run: () => actionsRef.current["file-export"]?.() },
    { id: "providers", label: "Providers and API keys", hint: "Tools", run: () => setProvidersOpen(true) },
    { id: "local", label: "Local AI: Ollama, LM Studio, ComfyUI", hint: "Tools · works offline", run: () => setLocalOpen(true) },
    { id: "settings", label: "Project settings", hint: "Project", run: () => setSettingsOpen(true) },
    { id: "rail", label: "Show or hide the side panels", hint: "View", run: () => setSidebarHidden((hidden) => !hidden) },
    { id: "help", label: "Getting started", hint: "Help", run: () => setHelpTopic("start") },
    { id: "keys", label: "Keyboard shortcuts", hint: "Help", run: () => setHelpTopic("shortcuts") },
    ...analysis.assets.map((asset, index) => ({ id: `asset-${asset.id}`, label: `Open ${asset.name}`, hint: `${asset.type} · Design`, run: () => { setSelectedAsset(index); setWorkspace("Design"); } })),
  ];
  /** Every file outside the queue that the project records: approved pictures, clips and reference photos. */
  const trackedPaths = [...Object.values(assetOutputs), ...clips.map((c) => c.path), ...Object.values(assetRefs).flat()];
  /** Files the project points at that are not on this computer: marks what depends on them, and says so. Used when a project loads and again just before a package is made. */
  const handleMissing = (n: number, missing: string[]) => {
    const jobs = dropMissing(queue, missing).state.jobs;
    const fixed = reconcileMissing(analysis.assets, assetOutputs, jobs, missing);
    const afterJobs = dropMissing(queue, missing).state.jobs;
    const lostShots = reconcileShots(shots, queue.jobs, afterJobs, missing);
    if (lostShots.length) setShots((list) => list.map((s) => (lostShots.includes(s.id) ? { ...s, storyboardStatus: "planned" } : s)));
    setAssetOutputs(fixed.outputs);
    if (fixed.demoted.length) setAnalysis((current) => ({ ...current, assets: current.assets.map((a) => (fixed.demoted.includes(a.id) ? { ...a, status: "planned" } : a)) }));
    const flagged = flagMissingClips(clips, missing);
    const clipCount = flagged === clips ? 0 : flagged.filter((c) => c.missing).length;
    if (flagged !== clips) setClips(() => flagged);
    const refs = dropMissingRefs(assetRefs, missing);
    if (refs.dropped) setAssetRefs(() => refs.refs);
    const parts = [
      n ? `${n} picture${n === 1 ? "" : "s"} (sheet views or storyboard frames)` : "",
      clipCount ? `${clipCount} audio or video clip${clipCount === 1 ? "" : "s"}` : "",
      refs.dropped ? `${refs.dropped} reference photo${refs.dropped === 1 ? "" : "s"}` : "",
    ].filter(Boolean);
    if (parts.length) setNotice(`Not on this computer: ${parts.join(", ")}. Views and frames are marked as needing a new picture (press Generate, or Use my image); clips say File missing; missing reference photos were taken off their lists.`);
  };
  useImageQueue(queue, setQueue, isTauri && hydrated, handleMissing, trackedPaths);
  const onSheetApproved = (job: ImageJob, primary: boolean) => {
    if (!job.outputPath) return;
    const path = job.outputPath;
    if (job.sheetType === "Storyboard") return;
    setAssetOutputs((current) => (primary || !current[job.assetId] ? { ...current, [job.assetId]: path } : current));
    if (primary) setAnalysis((current) => ({ ...current, assets: current.assets.map((a) => (a.id === job.assetId ? { ...a, status: "approved" } : a)) }));
  };
  // Messages fade on their own so a stale one never sits on screen.
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 12000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const golden = goldenPath(goldenInput);
  useEffect(() => {
    const index = golden.steps.findIndex((step) => step.state === "active");
    const current = { id: golden.next?.id ?? "done", index: index === -1 ? golden.steps.length : index };
    const before = prevStep.current;
    prevStep.current = current;
    if (hydrated && before && current.index > before.index && current.id !== before.id) {
      const done = golden.steps[current.index - 1];
      const finished = done ? `${done.label} complete (${done.detail.toLowerCase()})` : "Step complete";
      setNotice(golden.next ? `${finished}. Next: ${golden.next.action}.` : `${finished}. Your production is ready to deliver.`);
    }
  }, [golden.next?.id]);
  return (
    <div className={`po-shell${sidebarHidden ? " rails-hidden" : ""}`} style={{ zoom } as CSSProperties}>
      <input ref={scriptInput} type="file" hidden accept=".txt,.md,.fountain,.screenplay,.fdx,text/plain,text/markdown" onChange={(e) => { const file = e.target.files?.[0]; if (file) void importScript(file); e.target.value = ""; }} />
      <input ref={projectInput} type="file" hidden accept=".pone,.pguy,.json" onChange={async (e) => { const file = e.target.files?.[0]; if (file) await openText(await file.text(), null); e.target.value = ""; }} />
      <TopBar
        title={title}
        saveLabel={dirty ? "Unsaved changes" : filePath ? "Saved" : "Autosaved"}
        unsaved={dirty}
        workspace={workspace}
        onWorkspace={setWorkspace}
        reviewCount={queue.jobs.filter((j) => j.status === "needs-review").length}
        onAppearance={() => setAppearanceOpen(true)}
        onNext={goNext}
        golden={goldenInput}
        onOpenSettings={() => setSettingsOpen(true)}
        onPalette={() => setPaletteOpen(true)}
        onProviders={() => setProvidersOpen(true)}
        localUp={anyLocal(localAi.status)}
        onLocal={isTauri ? () => setLocalOpen(true) : undefined}
      />
      <main className="po-main">
        {localOpen && <LocalAiPanel onClose={() => setLocalOpen(false)} notify={setNotice} />}
        {helpTopic && <HelpSheet topic={helpTopic} onClose={() => setHelpTopic(null)} />}
        {pending && (
          <UnsavedSheet
            title={title}
            onSave={async () => { const run = pending.run; setPending(null); if (await saveProject()) run(); }}
            onDiscard={() => { const run = pending.run; setPending(null); run(); }}
            onCancel={() => setPending(null)}
          />
        )}
        {settingsOpen && (
          <div className="modal-backdrop" role="presentation" onClick={() => setSettingsOpen(false)}>
            <section className="sheet" role="dialog" aria-modal="true" aria-label="Project settings" onClick={(e) => e.stopPropagation()}>
              <div className="panel-heading">
                <h3 className="with-icon"><Settings2 size={20} aria-hidden="true" />Project settings</h3>
                <button className="secondary" onClick={() => setSettingsOpen(false)}>Done</button>
              </div>
              <label className="settings-field">
                <span>Title</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Project title" autoFocus />
              </label>
              <p className="helper">File: {filePath ?? "Not saved to a file yet"}</p>
              <p className="helper">Format: Production One project (.pone). Legacy .pguy files open and are converted by Save As.</p>
            </section>
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            <Check size={16} />
            {notice}
            <button onClick={() => setNotice("")}>Dismiss</button>
          </div>
        )}
        {providersOpen && (
          <div className="modal-backdrop" role="presentation">
            <section
              className="provider-modal"
              role="dialog"
              aria-label="AI provider registry"
            >
              <div className="panel-heading">
                <div>
                  <Eyebrow icon={Globe}>GLOBAL SERVICE</Eyebrow>
                  <h3 className="with-icon"><KeyRound size={20} aria-hidden="true" />AI Provider Registry</h3>
                </div>
                <button
                  className="secondary"
                  onClick={() => setProvidersOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="provider-grid">
                {providerRegistry.map((provider) => (
                  <article key={provider.id}>
                    <div>
                      <b>{provider.name}</b>
                      <span className={provider.status}>{provider.status}</span>
                    </div>
                    <p>{provider.notes}</p>
                    <small>Verified {provider.verifiedAt}</small>
                    <a
                      href={provider.documentationUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Official documentation
                    </a>
                  </article>
                ))}
              </div>
              <div className="credential-form">
                <label>
                  <span>Provider</span>
                  <select
                    value={credentialProvider}
                    onChange={(e) =>
                      setCredentialProvider(e.target.value as ProviderId)
                    }
                  >
                    {providerRegistry.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>
                    API key ·{" "}
                    {credentialConfigured ? "configured" : "not configured"}
                  </span>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); setCredentialError(""); }}
                    placeholder="Stored only in Windows Credential Manager"
                  />
                </label>
                <button
                  className="primary"
                  disabled={apiKey.length < (credentialProvider === "voicekiller-user" ? 1 : 8)}
                  onClick={saveCredential}
                >
                  Save securely
                </button>
                {credentialConfigured && (
                  <button className="secondary" onClick={removeCredential}>
                    Remove key
                  </button>
                )}
              </div>
              {credentialError && <p className="helper warn" role="alert">{credentialError}</p>}
            </section>
          </div>
        )}
        {workspace === "Projects" && (
          <ProjectsView title={title} filePath={filePath} analysis={analysis} golden={goldenInput} style={styleBible} recents={recents} onNew={() => guard(() => void newProject())} onOpen={() => guard(() => void openProject())} onSave={() => void saveProject()} onOpenRecent={(path) => guard(() => void openPath(path))} onForgetRecent={(path) => void forgetRecent(path)} onClearRecents={() => void clearRecents()} onKeys={() => setProvidersOpen(true)} onWorkspace={setWorkspace} onNext={goNext} />
        )}
        {workspace === "Story" && (
          <StoryView script={script} setScript={setScript} scriptArea={scriptArea} analysis={analysis} setAnalysis={setAnalysis} desktop={isTauri} notify={setNotice} onImport={() => void importScriptNative()} onAnalyze={analyze} onJump={jumpToLine} onAddProp={addNamedProp} onUseAge={useAgeFromReading} onAddAsset={addManualAsset} outputs={assetOutputs} onOpenAsset={(id) => { const i = analysis.assets.findIndex((x) => x.id === id); if (i >= 0) setSelectedAsset(i); setWorkspace("Design"); }} />
        )}
        {workspace === "Design" && (
          <DesignView activePromptPackage={activePromptPackage} analysis={analysis} approveAsset={approveAsset} assetOutputs={assetOutputs} assetRefs={assetRefs} clips={clips} copyPrompt={copyPrompt} exportAllPrompts={exportAllPrompts} exportPrompt={exportPrompt} focusSheetType={focusSheetType} generateImageDirect={generateImageDirect} generatingImage={generatingImage} importAsset={importAsset} jobs={jobs} modelRecommendations={modelRecommendations} onAddCharacter={(name, gender) => void addCharacterFromImage(name, gender)} onSheetApproved={onSheetApproved} openAiConfigured={openAiConfigured} plannedSheets={plannedSheets} promptMode={promptMode} providersOpen={providersOpen} queue={queue} queueAsset={queueAsset} reviseSelectedAsset={reviseSelectedAsset} runQueue={runQueue} selectedAsset={selectedAsset} setAnalysis={setAnalysis} setAssetRefs={setAssetRefs} setClips={setClips} setCredentialProvider={setCredentialProvider} setFocusSheetType={setFocusSheetType} setJobs={setJobs} setLocalOpen={setLocalOpen} setNotice={setNotice} setPromptMode={setPromptMode} setProvidersOpen={setProvidersOpen} setQueue={setQueue} setSelectedAsset={setSelectedAsset} setSheetNotes={setSheetNotes} setSheetSettings={setSheetSettings} sheetSettings={sheetSettings} setStyleBible={setStyleBible} sheetNotes={sheetNotes} studioControl={studioControl} styleBible={styleBible} />
        )}
        {workspace === "Review" && (
          <ReviewView analysis={analysis} queue={queue} setQueue={setQueue} onApproved={onSheetApproved} notify={setNotice} openDesign={() => setWorkspace("Design")} openAsset={(id) => { const i = analysis.assets.findIndex((x) => x.id === id); if (i >= 0) setSelectedAsset(i); setWorkspace("Design"); }} />
        )}
        {workspace === "Direct" && (
          <DirectView activeShot={activeShot} addShot={addShot} analysis={analysis} animaticPlaying={animaticPlaying} animaticTime={animaticTime} assetRefs={assetRefs} deleteShot={deleteShot} duplicateShot={duplicateShot} moveShot={moveShot} patchShot={patchShot} providersOpen={providersOpen} queue={queue} selectedShot={selectedShot} setAnimaticPlaying={setAnimaticPlaying} setAnimaticTime={setAnimaticTime} setLocalOpen={setLocalOpen} setNotice={setNotice} setProvidersOpen={setProvidersOpen} setQueue={setQueue} setSelectedShot={setSelectedShot} setShots={setShots} setStoryboardsEnabled={setStoryboardsEnabled} shots={shots} storyboardsEnabled={storyboardsEnabled} styleBible={styleBible} title={title} totalAnimaticDuration={totalAnimaticDuration} />
        )}
        {workspace === "Deliver" && (
          <DeliveryCenter
            analysis={analysis}
            shots={shots}
            audit={audit}
            sceneCoverage={sceneCoverage}
            queue={queue}
            setQueue={setQueue}
            compiled={compiled}
            model={model}
            setModel={setModel}
            selectedShot={selectedShot}
            setSelectedShot={setSelectedShot}
            kieConfigured={kieConfigured}
            submitting={submittingGeneration}
            onExportShot={() => downloadJson(`${activeShot.id}-${model.replace(/\s/g, "-")}.json`, compiled)}
            onBuild={buildProductionZip}
            onDirect={generateDirect}
            openAsset={(id) => { const i = analysis.assets.findIndex((x) => x.id === id); if (i >= 0) setSelectedAsset(i); setWorkspace("Design"); }}
            openShot={(id) => { const i = shots.findIndex((x) => x.id === id); if (i >= 0) setSelectedShot(i); setWorkspace(storyboardsEnabled ? "Direct" : "Design"); }}
            notify={setNotice}
            styleLocked={styleBible.locked}
            openProviders={() => setProvidersOpen(true)} openDesign={() => setWorkspace("Design")} onFix={(fix) => { if (fix.kind === "review") setWorkspace("Review"); else if (fix.kind === "script") setWorkspace("Story"); else if (fix.kind === "asset" && fix.assetId) { const i = analysis.assets.findIndex((x) => x.id === fix.assetId); if (i >= 0) setSelectedAsset(i); setWorkspace("Design"); } else setWorkspace("Design"); }}
          />
        )}
      </main>
      <QueueDock queue={queue} setQueue={setQueue} onOpen={() => setWorkspace("Design")} />
      {paletteOpen && <CommandPalette commands={paletteCommands} onClose={() => setPaletteOpen(false)} />}
      {appearanceOpen && <AppearanceMenu look={look} onLook={setLook} onClose={() => setAppearanceOpen(false)} />}
    </div>
  );
}
