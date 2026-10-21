import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Check, Copy, Cpu, RefreshCw, X } from "lucide-react";
import { addCustomWorkflow, refreshLocal, saveLocalConfig, useLocalAi } from "../data/localAi";
import { VISION_HINT, anyLocal, recommendedFor } from "../domain/localAi";

interface InstallPlan { ok: boolean; installed: boolean; reason: string; dest: string; path: string; start: string; gpu: string; vendor: string; vramGb: number; tag: string; downloadGb: number; needGb: number; freeGb: number; warnings: string[] }

const dot = (up: boolean) => <span className={`la-dot ${up ? "up" : ""}`} aria-label={up ? "Found" : "Not found"} role="img" />;

/** Everything about AI on this computer: what was found, what it has, what this machine can run, and how to get the rest. Works with no internet. */
export function LocalAiPanel({ onClose, notify }: { onClose: () => void; notify: (message: string) => void }) {
  const local = useLocalAi(true);
  const { status, templates, custom, config } = local;
  const [urls, setUrls] = useState({ ollamaUrl: "", lmstudioUrl: "", comfyUrl: "" });
  const [copied, setCopied] = useState("");
  const [plan, setPlan] = useState<InstallPlan | null>(null);
  const [progress, setProgress] = useState<{ stage: string; progress: number; detail: string } | null>(null);
  const [working, setWorking] = useState(false);
  const [modelPlans, setModelPlans] = useState<Record<string, Array<{ name: string; gb: number; present: boolean }>>>({});
  useEffect(() => {
    let off: (() => void) | undefined;
    void listen<{ stage: string; progress: number; detail: string }>("local-progress", (e) => setProgress(e.payload)).then((f) => { off = f; });
    return () => off?.();
  }, []);
  const comfyUrl = status.comfyui[0]?.url;
  useEffect(() => {
    if (!comfyUrl) return;
    void (async () => {
      const next: typeof modelPlans = {};
      for (const t of ["sdxl-keyframes", "wan22-5b-video"]) next[t] = await invoke<Array<{ name: string; gb: number; present: boolean }>>("comfy_model_plan", { base: comfyUrl, template: t }).catch(() => []);
      setModelPlans(next);
    })();
  }, [comfyUrl, templates]);
  const readPlan = async () => { try { setPlan(await invoke<InstallPlan>("comfy_install_plan", { dest: null })); } catch (e) { notify(String(e)); } };
  const installComfy = async () => {
    setWorking(true); setProgress({ stage: "Starting", progress: 0, detail: "" });
    try {
      await invoke("comfy_install", { dest: null });
      notify("ComfyUI is installed. Starting it now.");
      const fresh = await invoke<InstallPlan>("comfy_install_plan", { dest: null });
      setPlan(fresh);
      if (fresh.start) await invoke("comfy_start", { path: fresh.start });
      window.setTimeout(() => void refreshLocal(), 15000);
    } catch (e) { notify(String(e)); } finally { setWorking(false); setProgress(null); }
  };
  const startComfy = async (path: string) => { try { await invoke("comfy_start", { path }); notify("Starting ComfyUI. It takes about 30 seconds, then press Find local AI."); window.setTimeout(() => void refreshLocal(), 20000); } catch (e) { notify(String(e)); } };
  const getModels = async (template: string) => {
    if (!comfyUrl) return;
    setWorking(true); setProgress({ stage: "Starting", progress: 0, detail: "" });
    try { await invoke("comfy_download_models", { base: comfyUrl, template }); notify("The model files are in place."); await refreshLocal(); } catch (e) { notify(String(e)); } finally { setWorking(false); setProgress(null); }
  };
  useEffect(() => { if (local.checked && status.comfyui.length === 0) void readPlan(); }, [local.checked, status.comfyui.length]);
  useEffect(() => { setUrls({ ollamaUrl: config.ollamaUrl ?? "", lmstudioUrl: config.lmstudioUrl ?? "", comfyUrl: config.comfyUrl ?? "" }); }, [config.ollamaUrl, config.lmstudioUrl, config.comfyUrl]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const installedNames = [...status.ollama.models, ...status.lmstudio.models].map((m) => m.name);
  const recs = recommendedFor(status.hardware, installedNames);
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); setCopied(text); window.setTimeout(() => setCopied(""), 1800); } catch { /* Copying is a convenience. */ } };
  const saveUrls = async () => {
    try {
      const patch = Object.fromEntries(Object.entries(urls).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]));
      await saveLocalConfig(patch);
      await refreshLocal();
      notify("Local AI addresses saved.");
    } catch (e) { notify(String(e)); }
  };
  const addWorkflow = async () => {
    try { const name = await addCustomWorkflow(); if (name) { await refreshLocal(); notify(`Added your workflow "${name}". It appears in the model list under ComfyUI.`); } } catch (e) { notify(String(e)); }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="sheet la" role="dialog" aria-modal="true" aria-label="Local AI" onClick={(e) => e.stopPropagation()}>
        <div className="la-head">
          <div><span className="eyebrow">Works with no internet</span><h3><Cpu size={20} /> Local AI</h3></div>
          <div className="la-head-actions">
            <button className="secondary" onClick={() => void refreshLocal()} disabled={local.busy}><RefreshCw size={14} /> {local.busy ? "Looking…" : "Find local AI"}</button>
            <button className="icon-mini" onClick={onClose} aria-label="Close"><X size={16} /></button>
          </div>
        </div>
        <p className="helper">Production One finds Ollama, LM Studio and ComfyUI on this computer or your network by itself. Anything found here can write, plan and make images and video without sending anything online, and without per-image cost.</p>
        {local.error && <p className="helper warn" role="alert">{local.error}</p>}

        <div className="la-cards">
          <article className="la-card">
            <h4>{dot(status.ollama.up)} Ollama <small>writing, planning, reading images</small></h4>
            {status.ollama.up ? (
              <>
                <p className="la-meta">Version {status.ollama.version} · {status.ollama.url}</p>
                <ul>
                  {status.ollama.models.map((m) => (
                    <li key={m.name}>
                      <label><input type="radio" name="text-model" checked={config.textProvider === "ollama" && config.textModel === m.name} onChange={() => void saveLocalConfig({ textProvider: "ollama", textModel: m.name })} /> <b>{m.name}</b></label>
                      <small>{m.sizeGb} GB{VISION_HINT.test(m.name) ? " · can see images" : ""}</small>
                    </li>
                  ))}
                  {status.ollama.models.length === 0 && <li className="helper">Ollama is running but has no models yet. Pick one below and run its command in a terminal.</li>}
                </ul>
              </>
            ) : <p className="helper">Not found on {status.ollama.url || "http://127.0.0.1:11434"}. Install Ollama from ollama.com and start it; this page finds it by itself.</p>}
          </article>

          <article className="la-card">
            <h4>{dot(status.lmstudio.up)} LM Studio <small>writing and planning</small></h4>
            {status.lmstudio.up ? (
              <ul>
                {status.lmstudio.models.map((m) => (
                  <li key={m.name}><label><input type="radio" name="text-model" checked={config.textProvider === "lmstudio" && config.textModel === m.name} onChange={() => void saveLocalConfig({ textProvider: "lmstudio", textModel: m.name })} /> <b>{m.name}</b></label>{VISION_HINT.test(m.name) && <small>can see images</small>}</li>
                ))}
                {status.lmstudio.models.length === 0 && <li className="helper">The server is on but no model is loaded. Load one in LM Studio.</li>}
              </ul>
            ) : <p className="helper">Not found. In LM Studio open the Developer tab and start the local server (port 1234), then press Find local AI.</p>}
          </article>

          <article className="la-card wide">
            <h4>{dot(status.comfyui.length > 0)} ComfyUI <small>images and video</small></h4>
            {status.comfyui.length > 0 ? (
              <>
                <p className="la-meta">{status.comfyui[0].device || "GPU"} · {status.comfyui[0].vramGb} GB · version {status.comfyui[0].version} · {status.comfyui[0].url}</p>
                <ul className="la-templates">
                  {templates.map((t) => (
                    <li key={t.id} className={t.ready ? "ready" : ""}>
                      <span className="la-state">{t.ready ? <Check size={14} /> : <X size={14} />}</span>
                      <div><b>{t.title}</b><small>{t.ready ? `Ready · uses ${t.uses}` : `Missing: ${t.missing.join("; ")}`}</small><small>{t.note}</small></div>
                    </li>
                  ))}
                  {custom.map((c) => <li key={c} className="ready"><span className="la-state"><Check size={14} /></span><div><b>Your workflow: {c}</b><small>Imported from ComfyUI (API format)</small></div></li>)}
                </ul>
                {(["sdxl-keyframes", "wan22-5b-video"] as const).map((t) => { const files = modelPlans[t] ?? []; const missing = files.filter((f) => !f.present); const tpl = templates.find((x) => x.id === t); return files.length > 0 && missing.length > 0 && !tpl?.ready ? <div key={t} className="la-install"><p>{t === "wan22-5b-video" ? "Video (Wan 2.2 5B)" : "Images (SDXL)"}: {missing.length} file{missing.length === 1 ? "" : "s"} to download, {missing.reduce((n, f) => n + f.gb, 0).toFixed(1)} GB, from Hugging Face.</p><button className="secondary" disabled={working} onClick={() => void getModels(t)}>{working ? "Downloading…" : "Download the models"}</button></div> : null; })}
                {progress && <div className="la-progress" role="status"><div><i style={{ width: `${Math.round(progress.progress * 100)}%` }} /></div><small>{progress.stage}{progress.detail ? ` · ${progress.detail}` : ""}</small></div>}
                <button className="secondary" onClick={() => void addWorkflow()}>Add my own workflow…</button>
                <p className="helper">In ComfyUI choose Workflow, Export (API), then add the file here. Type {"{{prompt}}"}, {"{{seed}}"}, {"{{width}}"}, {"{{height}}"} and {"{{image}}"} into its fields to let Production One fill them.</p>
              </>
            ) : (
              <div>
                <p className="helper">ComfyUI is not running (looked at ports 8188 and 8000).</p>
                {plan?.installed && plan.start && <button className="primary" onClick={() => void startComfy(plan.start)}>Start ComfyUI</button>}
                {plan && !plan.installed && (
                  <div className="la-install">
                    {plan.ok ? (
                      <>
                        <p><b>Install ComfyUI for me</b>: the official portable build for your {plan.gpu || "graphics card"} ({plan.tag}). Download {plan.downloadGb} GB, about {plan.needGb} GB of disk with room for models ({plan.freeGb} GB free). It goes to {plan.dest} and is checked against the checksum GitHub publishes.</p>
                        {plan.warnings.map((w) => <p key={w} className="helper warn">{w}</p>)}
                        <button className="primary" disabled={working} onClick={() => void installComfy()}>{working ? "Installing…" : "Install ComfyUI"}</button>
                      </>
                    ) : <p className="helper warn">{plan.reason}</p>}
                  </div>
                )}
                {!plan && <button className="secondary" onClick={() => void readPlan()}>Check what is possible on this computer</button>}
                {progress && <div className="la-progress" role="status"><div><i style={{ width: `${Math.round(progress.progress * 100)}%` }} /></div><small>{progress.stage}{progress.detail ? ` · ${progress.detail}` : ""}</small></div>}
              </div>
            )}
          </article>
        </div>

        <h4 className="la-h">This computer</h4>
        <p className="la-meta">{status.hardware.gpu ? `${status.hardware.gpu} · ${status.hardware.vramGb} GB graphics memory (${status.hardware.vramFreeGb} GB free)` : "No NVIDIA graphics card was detected"} · {status.hardware.ramGb ? `${status.hardware.ramGb} GB RAM` : "RAM unknown"}</p>

        <h4 className="la-h">What suits it</h4>
        <ul className="la-recs">
          {recs.map((r) => (
            <li key={r.name} className={r.installed ? "have" : ""}>
              <div><span className={`la-fit ${r.fit}`}>{r.fit}</span> <b>{r.name}</b> <small>{r.group}{r.sizeGb ? ` · ${r.sizeGb} GB` : ""}{r.installed ? " · installed" : ""}</small><p>{r.why}</p><code>{r.how}</code></div>
              {r.how.startsWith("ollama pull") && !r.installed && <button className="icon-mini" onClick={() => void copy(r.how)} aria-label={`Copy the command for ${r.name}`} title="Copy the command">{copied === r.how ? <Check size={14} /> : <Copy size={14} />}</button>}
            </li>
          ))}
        </ul>
        <p className="helper">These are starting points, not promises: the local scene changes quickly. Only the Ollama names and sizes were checked against Ollama's library; for images and video, ComfyUI's template browser always has the newest.</p>

        <details className="la-adv">
          <summary>Addresses</summary>
          <div className="la-urls">
            <label><span>Ollama</span><input value={urls.ollamaUrl} placeholder="http://127.0.0.1:11434" onChange={(e) => setUrls({ ...urls, ollamaUrl: e.target.value })} /></label>
            <label><span>LM Studio</span><input value={urls.lmstudioUrl} placeholder="http://127.0.0.1:1234" onChange={(e) => setUrls({ ...urls, lmstudioUrl: e.target.value })} /></label>
            <label><span>ComfyUI</span><input value={urls.comfyUrl} placeholder="http://127.0.0.1:8188" onChange={(e) => setUrls({ ...urls, comfyUrl: e.target.value })} /></label>
            <button className="secondary" onClick={() => void saveUrls()}>Save and look again</button>
          </div>
          <p className="helper">Only this computer or machines on your own network are accepted (for example http://192.168.1.20:8188).</p>
        </details>
        {!anyLocal(status) && local.checked && <p className="helper warn">Nothing local was found yet. The app still works with your cloud providers.</p>}
      </section>
    </div>
  );
}

