import type { ShotRecord } from "./domain/productionStudio";

/** Pure helpers and constants that used to live at the top of App.tsx. */
export const initialShot: ShotRecord = {
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

export const designSections = [
  { id: "sec-identity", label: "Identity" },
  { id: "sec-sheets", label: "Reference sheets" },
  { id: "sec-motion", label: "Motion" },
  { id: "sec-voice", label: "Voice and sound" },
];

export function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
export function downloadText(name: string, value: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const isTauri = "__TAURI_INTERNALS__" in window;
