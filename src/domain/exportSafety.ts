/**
 * Keeps credentials and machine-specific model files out of packages and exports. An export that would include any of them is refused with the reason; nothing is
 * stripped silently. The same rules are enforced again in the desktop app's package writer (src-tauri/src/lib.rs).
 */
const FILE_RULES: Array<{ test: RegExp; why: string }> = [
  { test: /(^|[\\/])\.env(\.[^\\/]*)?$/i, why: 'an environment file (it usually holds keys)' },
  { test: /(^|[\\/])(id_rsa|id_ed25519|id_ecdsa)(\.pub)?$/i, why: 'an SSH key' },
  { test: /\.(pem|key|p12|pfx|jks|keystore|kdbx|ppk)$/i, why: 'a key or certificate file' },
  { test: /(^|[\\/])(credentials|secrets?|auth|token)s?\.(json|ya?ml|toml|ini|txt)$/i, why: 'a credentials file' },
  { test: /(^|[\\/])(\.netrc|\.npmrc|\.pypirc|\.git-credentials)$/i, why: 'a credentials file' },
  { test: /\.(safetensors|ckpt|gguf|ggml|pt|pth|onnx|bin\.index|lora)$/i, why: 'a machine-specific model file' },
  { test: /(^|[\\/])(ComfyUI|comfyui)[\\/](models|custom_nodes)[\\/]/, why: 'a file from a local ComfyUI install' },
  { test: /(^|[\\/])\.ollama[\\/]/i, why: 'a file from a local Ollama install' },
]

const CONTENT_RULES: Array<{ test: RegExp; why: string }> = [
  { test: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, why: 'a private key' },
  { test: /\bsk-[A-Za-z0-9_-]{20,}/, why: 'an API key that looks like an OpenAI or similar key' },
  { test: /\bAIza[0-9A-Za-z_-]{30,}/, why: 'a Google API key' },
  { test: /\bxox[abp]-[0-9A-Za-z-]{10,}/, why: 'a Slack token' },
  { test: /\bgh[pousr]_[A-Za-z0-9]{30,}/, why: 'a GitHub token' },
  { test: /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/, why: 'a bearer token' },
  { test: /"(api[_-]?key|secret|password|access[_-]?token|authorization)"\s*:\s*"[^"]{8,}"/i, why: 'a credential field with a value' },
]

export interface SafetyProblem { where: string; why: string }

/** The first reason a file name or path may not go into a package, or undefined. */
export function unsafeFileReason(path: string): string | undefined {
  return FILE_RULES.find((r) => r.test.test(path))?.why
}

/** Checks every file path and every text that will be written. Returns every problem found; an empty list means the export may go ahead. */
export function checkExport(filePaths: string[], texts: Array<{ name: string; text: string }> = []): SafetyProblem[] {
  const problems: SafetyProblem[] = []
  for (const path of filePaths) { const why = unsafeFileReason(path); if (why) problems.push({ where: path, why }) }
  for (const t of texts) { const hit = CONTENT_RULES.find((r) => r.test.test(t.text)); if (hit) problems.push({ where: t.name, why: hit.why }) }
  return problems
}

export const safetyMessage = (problems: SafetyProblem[]): string =>
  `No package was made: it would have included ${problems.slice(0, 3).map((p) => `${p.why} (${p.where.split(/[\\/]/).pop()})`).join(', ')}${problems.length > 3 ? ` and ${problems.length - 3} more` : ''}. Credentials and model files never go into a package. Remove them and export again.`
