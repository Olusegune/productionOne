import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { DeliveryCenter } from "./components/DeliveryCenter";
import { convertScript, type ScriptKind } from "./engine/importers";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Clapperboard,
  Copy,
  Download,
  FolderKanban,
  PackageCheck,
  Pause,
  PenTool,
  Play,
  Plus,
  Search,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { BrandMark } from "./components/BrandMark";
import { ArtDirectionBar } from "./components/ArtDirectionBar";
import { EditableInventory } from "./components/EditableInventory";
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
  animaticDuration,
  cancelJob,
  compileAssetPrompt,
  compileShotPackage,
  coverageAudit,
  normalizeShotOrder,
  pauseQueue,
  resumeQueue,
  retryJob,
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
import { sampleStory } from "./engine/sampleStory";
import { SheetStudio } from "./components/SheetStudio";
import { RealImage } from "./components/RealImage";
import { MotionDemo } from "./components/MotionDemo";
import { DirectRoom } from "./components/DirectRoom";
import { LocalAiPanel } from "./components/LocalAiPanel";
import { useLocalAi } from "./data/localAi";
import { anyLocal } from "./domain/localAi";
import type { DemoClip } from "./domain/demoClips";
import { AssetInspector, BibleTree } from "./components/bible";
import { ReadingPanel } from "./components/ReadingPanel";
import { CommandPalette, QueueDock, TopBar, type PaletteCommand } from "./components/shell";
import { useImageQueue } from "./data/useImageQueue";
import { emptyQueue, recover, type ImageJob, type QueueState } from "./domain/generationQueue";
import { GoldenPath } from "./components/GoldenPath";
import { HelpSheet, type HelpTopic } from "./components/HelpSheet";
import { UnsavedSheet } from "./components/UnsavedSheet";
import { goldenPath, type GoldenPathInput, type GoldenStep } from "./domain/goldenPath";
import { buildProjectFile, parseProjectFile, suggestedFileName, type ProjectFile } from "./data/projectFile";

const workspaces = [
  { name: "Projects", icon: FolderKanban },
  { name: "Story", icon: PenTool },
  { name: "Design", icon: Sparkles },
  { name: "Direct", icon: Clapperboard, optional: true },
  { name: "Deliver", icon: PackageCheck },
];
const sampleScript = sampleStory;
const initialShot: ShotRecord = {
  id: "SHOT-001",
  sceneId: "SCENE-001",
  order: 1,
  duration: 5,
  assetIds: [],
  action: "Amina raises the solar compass and studies its glow.",
  dialogue: "We are close.",
  speaker: "AMINA",
  emotionalObjective: "Quiet resolve beneath exhaustion",
  facialActing: "Focused eyes, relaxed jaw",
  bodyLanguage: "Balanced stance, shoulders settling",
  microAnimation: "One blink, slow breath, slight grip adjustment",
  cameraFraming: "Medium close-up",
  cameraMovement: "Slow push in",
  lighting: "Warm dusk edge light with neutral skin tones",
  soundEffects: "Cloth movement, compass hum",
  ambience: "Soft savanna wind",
  music: "Low restrained strings",
  transition: "Cut",
  storyboardStatus: "planned",
};

const isTauri = "__TAURI_INTERNALS__" in window;
function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
function downloadText(name: string, value: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

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
    [localOpen, setLocalOpen] = useState(false),
    [clips, setClipsState] = useState<DemoClip[]>([]),
    [assetRefs, setAssetRefsState] = useState<Record<string, string[]>>({});
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
    () => ({ script, analysis, shots, jobs, storyboardsEnabled, model, assetOutputs, styleBible, title, queue, clips, assetRefs }),
    [script, analysis, shots, jobs, storyboardsEnabled, model, assetOutputs, styleBible, title, queue, clips, assetRefs],
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
    const next = analyzeScript(script);
    setAnalysis(next);
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
      packageName: `The-Last-Horizon-${activeShot.id}`,
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
    setFilePath(path);
    setSelectedAsset(0);
    setSelectedShot(0);
    setDirty(false);
  };
  const newProject = () => {
    applyProject(
      buildProjectFile("Untitled production", { schemaVersion: 1, nodes: [], edges: [] }, {
        script: "", analysis: { scenes: [], assets: [] }, shots: [], jobs: [], storyboardsEnabled: false,
        model: "Seedance 2.0", assetOutputs: {}, styleBible: defaultStyleBible,
      }),
      null,
    );
    setWorkspace("Story");
    setNotice("New production created. Paste or import your script to begin.");
  };
  const openText = (text: string, path: string | null) => {
    const parsed = parseProjectFile(text);
    if (!parsed.ok) { setNotice(parsed.error); return; }
    applyProject(parsed.file, parsed.legacy ? null : path);
    setWorkspace("Projects");
    setNotice(
      parsed.legacy
        ? `Opened legacy Production Guy project "${parsed.file.title}". The original file is untouched; Save writes a new .pone.`
        : `Opened ${path ?? parsed.file.title}`,
    );
  };
  const openProject = async () => {
    if (!isTauri) { projectInput.current?.click(); return; }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const opened = await invoke<{ path: string; contents: string } | null>("open_project_dialog");
      if (opened) { openText(opened.contents, opened.path); void refreshRecents(); }
    } catch (error) { setNotice(`Could not open the project: ${String(error)}`); }
  };
  const openPath = async (path: string) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const opened = await invoke<{ path: string; contents: string }>("open_project_path", { path });
      openText(opened.contents, opened.path);
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
    "file-new": () => guard(newProject),
    "file-open": () => guard(() => void openProject()),
    "file-save": () => void saveProject(),
    "file-save-as": () => void saveProject(true),
    "file-import": () => { setWorkspace("Story"); void importScriptNative(); },
    "file-export": () => { setWorkspace("Deliver"); void buildProductionZip(); },
    "file-close": () => guard(newProject),
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
      if (dead) { a(); b(); c(); } else offs = [a, b, c];
    });
    return () => { dead = true; offs.forEach((off) => off()); };
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen((open) => !open); }
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
    ...["Projects", "Story", "Design", "Direct", "Deliver"].map((name) => ({ id: `go-${name}`, label: `Go to ${name}`, hint: "Workspace", run: () => setWorkspace(name) })),
    { id: "analyze", label: "Analyze the script", hint: "Story · free, local", run: () => { setWorkspace("Story"); analyze(); } },
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
  useImageQueue(queue, setQueue, isTauri && hydrated);
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
      <input ref={projectInput} type="file" hidden accept=".pone,.pguy,.json" onChange={async (e) => { const file = e.target.files?.[0]; if (file) openText(await file.text(), null); e.target.value = ""; }} />
      <TopBar
        title={title}
        saveLabel={dirty ? "Unsaved changes" : filePath ? "Saved" : "Autosaved"}
        unsaved={dirty}
        workspace={workspace}
        onWorkspace={setWorkspace}
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
                <h3>Project settings</h3>
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
                  <span className="eyebrow">GLOBAL SERVICE</span>
                  <h3>AI Provider Registry</h3>
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
                  disabled={apiKey.length < 8}
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
          <section className="po-launch">
            <div className="po-launch-head">
              <div>
                <span className="eyebrow">{filePath ?? "AUTOSAVED PRODUCTION"}</span>
                <h2>{title}</h2>
                <p>
                  {analysis.scenes.length} scene{analysis.scenes.length === 1 ? "" : "s"} · {analysis.assets.filter((a) => a.type === "character").length} characters ·{" "}
                  {analysis.assets.filter((a) => a.type === "prop").length} props · {analysis.assets.filter((a) => a.type === "set" || a.type === "environment").length} sets ·{" "}
                  {goldenInput.approvedCount} of {goldenInput.assetCount} approved
                </p>
              </div>
              <div className="hero-actions">
                <button className="secondary" onClick={() => guard(newProject)}>New</button>
                <button className="secondary" onClick={() => guard(() => void openProject())}>Open…</button>
                <button className="secondary" onClick={() => void saveProject()}><Download size={15} /> Save</button>
              </div>
            </div>
            <GoldenPath input={goldenInput} onGo={setWorkspace} onNext={goNext} />
            {recents.length > 0 && (
              <div className="recent-list">
                <span className="eyebrow">RECENT PROJECTS</span>
                <ul>
                  {recents.slice(0, 5).map((path) => (
                    <li key={path}>
                      <button onClick={() => guard(() => void openPath(path))} title={path}>{path.split(/[\\/]/).pop()}</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="helper">Press Ctrl+K for the command palette: it can open any asset, import a script, save or export without leaving the keyboard.</p>
          </section>
        )}
        {workspace === "Story" && (
          <section className="two-column studio-page">
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">SCRIPT INTELLIGENCE</span>
                  <h3>Source material</h3>
                </div>
                <div className="button-row">
                  <button className="secondary" onClick={() => void importScriptNative()}>Import script</button>
                  <button className="primary" onClick={analyze}>
                    Analyze script
                  </button>
                </div>
              </div>
              <textarea
                ref={scriptArea}
                className="script-editor"
                value={script}
                onChange={(e) => setScript(e.target.value)}
                aria-label="Script source"
              />
              <p className="helper">
                Scene headings, source dialogue, characters, sets, and used
                props are extracted locally. Suggested dialogue is never mixed
                with source dialogue.
              </p>
            </div>
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">EDITABLE INVENTORY</span>
                  <h3>
                    {analysis.scenes.length} scenes · {analysis.assets.length}{" "}
                    assets
                  </h3>
                </div>
              </div>
              <ReadingPanel story={analysis.story} onJump={jumpToLine} desktop={isTauri} onStory={(story) => setAnalysis((a) => ({ ...a, story }))} notify={setNotice} />
              <EditableInventory
                analysis={analysis}
                onChange={setAnalysis}
                onAdd={addManualAsset}
              />
            </div>
          </section>
        )}
        {workspace === "Design" && (
          <div className="po-design">
            <BibleTree assets={analysis.assets} story={analysis.story} queue={queue} selected={selectedAsset} onSelect={setSelectedAsset} />
            <div className="po-canvas design-workspace">
            <ArtDirectionBar
              style={styleBible}
              onChange={setStyleBible}
              sheetCount={plannedSheets.length}
            />
            <SheetStudio
              assets={analysis.assets}
              scenes={analysis.scenes}
              story={analysis.story}
              assetIndex={selectedAsset}
              style={styleBible}
              queue={queue}
              setQueue={setQueue}
              desktop={isTauri}
              providersVersion={Number(providersOpen)}
              onApproved={onSheetApproved}
              notify={setNotice}
              openProviders={() => setProvidersOpen(true)}
              openLocal={() => setLocalOpen(true)}
              controlRef={studioControl}
              refs={assetRefs}
              setRefs={setAssetRefs}
            />
            <MotionDemo
              asset={analysis.assets[Math.min(selectedAsset, Math.max(0, analysis.assets.length - 1))]}
              queue={queue}
              clips={clips}
              setClips={setClips}
              style={styleBible}
              desktop={isTauri}
              notify={setNotice}
              openProviders={() => setProvidersOpen(true)}
            />
            <details className="po-classic">
            <summary>Prompt Studio, model hub, imports and quality tools</summary>
            <section className="three-column">
              <div className="panel asset-browser">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">SHARED ASSET REGISTRY</span>
                    <h3>Production assets</h3>
                  </div>
                </div>
                {analysis.assets.map((asset, index) => (
                  <button
                    className={selectedAsset === index ? "selected" : ""}
                    key={asset.id}
                    onClick={() => setSelectedAsset(index)}
                  >
                    <span className={`kind ${asset.type}`}>
                      {asset.type.slice(0, 2)}
                    </span>
                    <span>
                      <b>{asset.name}</b>
                      <small>
                        {asset.id} ·{" "}
                        {
                          plannedSheets.filter(
                            (sheet) => sheet.assetId === asset.id,
                          ).length
                        }{" "}
                        sheets
                      </small>
                    </span>
                    <i className={asset.status}>{asset.status}</i>
                  </button>
                ))}
              </div>
              <div className="panel design-preview">
                {analysis.assets[selectedAsset] && activePromptPackage && (
                  <>
                    <div className="panel-heading">
                      <div>
                        <span className="eyebrow">
                          {analysis.assets[selectedAsset].type.toUpperCase()} ·{" "}
                          {analysis.assets[selectedAsset].id}
                        </span>
                        <h3>{analysis.assets[selectedAsset].name}</h3>
                      </div>
                      <span
                        className={`status ${analysis.assets[selectedAsset].status}`}
                      >
                        {analysis.assets[selectedAsset].status}
                      </span>
                    </div>
                    <RealImage
                      path={assetOutputs[analysis.assets[selectedAsset].id]}
                      label={`Approved reference for ${analysis.assets[selectedAsset].name}`}
                      empty="No approved reference yet. Generate or add one above."
                    />
                    <div className="prompt-tabs">
                      {(
                        [
                          "universal",
                          "compact",
                          "technical",
                          "negative",
                        ] as Array<keyof PromptPackage>
                      ).map((mode) => (
                        <button
                          className={promptMode === mode ? "active" : ""}
                          onClick={() => setPromptMode(mode)}
                          key={mode}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                    <div className="prompt-box">
                      <span>{promptMode.toUpperCase()} PROMPT</span>
                      <p>{activePromptPackage[promptMode]}</p>
                    </div>
                    <div className="prompt-actions">
                      <button className="secondary" onClick={copyPrompt}>
                        <Copy size={13} /> Copy
                      </button>
                      {(["txt", "md", "json", "csv"] as const).map((format) => (
                        <button
                          className="secondary"
                          key={format}
                          onClick={() => exportPrompt(format)}
                        >
                          {format.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <div className="model-match">
                      <span>RECOMMENDED MODEL</span>
                      <b>{modelRecommendations[0]?.name}</b>
                      <small>
                        {modelRecommendations[0]?.score}/100 ·{" "}
                        {modelRecommendations[0]?.reason}
                      </small>
                    </div>
                    <div className="image-generation-gate">
                      <button
                        className="primary"
                        disabled={
                          !openAiConfigured ||
                          generatingImage
                        }
                        onClick={generateImageDirect}
                      >
                        {generatingImage
                          ? "Generating…"
                          : "Generate verified image"}
                      </button>
                      <small>
                        {openAiConfigured
                          ? "OpenAI credential configured."
                          : "Configure OpenAI in Global production tools."}{" "}
                        Provider pricing is not assumed; confirm the ceiling
                        against your account.
                      </small>
                    </div>
                    <div className="button-row">
                      <button
                        className="primary"
                        onClick={() => approveAsset(selectedAsset)}
                      >
                        Approve identity
                      </button>
                      <label className="secondary file-button">
                        Import & QA
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void importAsset(file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <button className="secondary" onClick={queueAsset}>
                        <Plus size={14} /> Queue prompt package
                      </button>
                      <button
                        className="secondary"
                        onClick={reviseSelectedAsset}
                      >
                        Revise & selectively regenerate
                      </button>
                    </div>
                    {assetOutputs[analysis.assets[selectedAsset].id] && (
                      <p className="helper">
                        Verified labeled reference:{" "}
                        {assetOutputs[analysis.assets[selectedAsset].id]}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">DURABLE QUEUE</span>
                    <h3>Production jobs</h3>
                  </div>
                  <div className="queue-controls">
                    <button
                      title="Pause queue"
                      onClick={() => setJobs(pauseQueue)}
                    >
                      <Pause size={12} />
                    </button>
                    <button
                      title="Resume queue"
                      onClick={() => setJobs(resumeQueue)}
                    >
                      <Play size={12} />
                    </button>
                  </div>
                </div>
                <div className="queue-list">
                  {jobs.length === 0 ? (
                    <p className="empty">No jobs queued.</p>
                  ) : (
                    jobs.map((job) => (
                      <div key={job.id}>
                        <span>
                          <b>{job.id}</b>
                          <small>
                            {job.assetId}
                            {job.outputPath ? ` · ${job.outputPath}` : ""}
                            {job.error ? ` · ${job.error}` : ""}
                          </small>
                        </span>
                        <i className={job.status}>{job.status}</i>
                        {job.status !== "complete" &&
                          job.status !== "cancelled" && (
                            <button
                              title={`Cancel ${job.id}`}
                              onClick={() =>
                                setJobs((current) => cancelJob(current, job.id))
                              }
                            >
                              ×
                            </button>
                          )}
                        {(job.status === "failed" ||
                          job.status === "cancelled") && (
                          <button
                            title={`Retry ${job.id}`}
                            onClick={() =>
                              setJobs((current) => retryJob(current, job.id))
                            }
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
                <button
                  className="primary full"
                  onClick={runQueue}
                  disabled={!jobs.some((j) => j.status === "queued")}
                >
                  <Play size={14} /> Process next job
                </button>
                <button className="secondary full" onClick={exportAllPrompts}>
                  <Download size={14} /> Export all prompts
                </button>
                <p className="helper">
                  A job completes only after its output package is written.
                  Queue state survives restart.
                </p>
              </div>
            </section>
            </details>
            </div>
            <AssetInspector asset={analysis.assets[Math.min(selectedAsset, Math.max(0, analysis.assets.length - 1))]} story={analysis.story} />
          </div>
        )}
        {workspace === "Direct" && (
          <div className="dr-wrap">
            <DirectRoom
              analysis={analysis}
              shots={shots}
              setShots={(u) => setShots(u)}
              queue={queue}
              setQueue={setQueue}
              style={styleBible}
              assetRefs={assetRefs}
              desktop={isTauri}
              providersVersion={Number(providersOpen)}
              enabled={storyboardsEnabled}
              setEnabled={setStoryboardsEnabled}
              title={title}
              notify={setNotice}
              openProviders={() => setProvidersOpen(true)}
              openLocal={() => setLocalOpen(true)}
            />
            {storyboardsEnabled && (
              <details className="po-classic">
                <summary>Classic shot editor and video prompt compiler</summary>
          <section className="studio-page legacy-ui">
            <div className="optional-banner">
              <div>
                <span className="eyebrow">OPTIONAL WORKFLOW</span>
                <h2>Director’s Room</h2>
                <p>Enable shot planning without rebuilding the project.</p>
              </div>
              <button
                className={storyboardsEnabled ? "primary" : "secondary"}
                onClick={() => setStoryboardsEnabled(!storyboardsEnabled)}
              >
                {storyboardsEnabled
                  ? "Storyboarding enabled"
                  : "Enable storyboarding"}
              </button>
            </div>
            {storyboardsEnabled ? (
              <div className="two-column">
                <div className="panel shot-preview">
                  <div className="real-empty" role="img" aria-label="No storyboard frame">
                    Storyboard frames for {activeShot.id} are not generated yet. This preview shows only real frames.
                  </div>
                  <div className="timeline">
                    <span
                      style={{
                        width: `${totalAnimaticDuration ? (animaticTime / totalAnimaticDuration) * 100 : 0}%`,
                      }}
                    />
                    <button
                      className="timeline-play"
                      onClick={() => setAnimaticPlaying((value) => !value)}
                    >
                      {animaticPlaying ? (
                        <Pause size={14} />
                      ) : (
                        <Play size={14} />
                      )}
                    </button>
                    <b>
                      {animaticTime.toFixed(1)} /{" "}
                      {totalAnimaticDuration.toFixed(1)}s
                    </b>
                    <small>
                      {activeShot.id} · {activeShot.action}
                    </small>
                  </div>
                  <div className="editor-actions">
                    <button
                      className="secondary"
                      onClick={() => moveShot(-1)}
                      disabled={selectedShot === 0}
                    >
                      <ArrowLeft size={13} /> Earlier
                    </button>
                    <button
                      className="secondary"
                      onClick={() => moveShot(1)}
                      disabled={selectedShot === shots.length - 1}
                    >
                      Later <ArrowRight size={13} />
                    </button>
                    <button className="secondary" onClick={duplicateShot}>
                      <Copy size={13} /> Duplicate
                    </button>
                    <button className="secondary danger" onClick={deleteShot}>
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                  <div className="shot-strip">
                    {shots.map((shot, index) => (
                      <button
                        className={index === selectedShot ? "selected" : ""}
                        key={shot.id}
                        onClick={() => {
                          setSelectedShot(index);
                          setAnimaticPlaying(false);
                          setAnimaticTime(
                            shots
                              .slice(0, index)
                              .reduce(
                                (total, item) => total + item.duration,
                                0,
                              ),
                          );
                        }}
                      >
                        <span>{shot.id}</span>
                        <b>{shot.cameraFraming}</b>
                        <small>
                          {shot.duration.toFixed(1)}s · {shot.storyboardStatus}
                        </small>
                      </button>
                    ))}
                    <button onClick={addShot}>
                      <Plus /> Add shot
                    </button>
                  </div>
                </div>
                <div className="panel shot-form">
                  <span className="eyebrow">SHOT EDITOR · {activeShot.id}</span>
                  <h3>Performance & camera direction</h3>
                  {(
                    [
                      ["action", "Action"],
                      ["dialogue", "Dialogue (source)"],
                      ["emotionalObjective", "Emotional objective"],
                      ["facialActing", "Facial acting"],
                      ["bodyLanguage", "Body language"],
                      ["microAnimation", "Micro-animation"],
                      ["cameraFraming", "Camera framing"],
                      ["cameraMovement", "Camera movement"],
                      ["soundEffects", "Sound effects"],
                      ["ambience", "Ambience"],
                    ] as Array<[keyof ShotRecord, string]>
                  ).map(([field, label]) => (
                    <label key={field}>
                      <span>{label}</span>
                      <input
                        value={String(activeShot[field])}
                        onChange={(e) => patchShot(field, e.target.value)}
                      />
                    </label>
                  ))}
                  <label>
                    <span>Duration</span>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={activeShot.duration}
                      onChange={(e) =>
                        patchShot("duration", Number(e.target.value))
                      }
                    />
                  </label>
                  <button
                    className="primary full"
                    onClick={() => patchShot("storyboardStatus", "approved")}
                  >
                    Approve shot plan
                  </button>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <Clapperboard size={34} />
                <h3>Storyboarding is off</h3>
                <p>Asset production and delivery remain fully available.</p>
              </div>
            )}
          </section>
              </details>
            )}
          </div>
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
          />
        )}
      </main>
      <QueueDock queue={queue} setQueue={setQueue} onOpen={() => setWorkspace("Design")} />
      {paletteOpen && <CommandPalette commands={paletteCommands} onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
