#!/usr/bin/env node
// Production One MCP server (stdio). It lets an MCP client such as Claude Desktop read a running Production One project and ask it for a plan,
// and, only if the person has allowed it inside the app, start a budget-limited run. It has no dependencies and no keys: it talks to the app's local door
// (127.0.0.1) with the access code the app writes to its own data folder when "Let agents connect" is switched on.
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

const SERVER = { name: 'production-one', version: '0.1.0' }

export const TOOLS = [
  { name: 'get_status', description: 'What the app is doing now: the phase of the current run, pictures made, in progress, failed and waiting for the person, and an estimate of what was sent.', inputSchema: { type: 'object', properties: {} } },
  { name: 'list_items', description: 'The characters, props and places in the open project, and whether each has a picture and an approved picture.', inputSchema: { type: 'object', properties: {} } },
  { name: 'read_script', description: 'Give the app a script (screenplay text, Fountain style: scene headings like INT. PLACE - DAY, character names in capitals before their lines). The app reads it and finds the characters, places and props. This replaces nothing the person typed by hand.', inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'The script text.' }, name: { type: 'string', description: 'A name for the script, for the chat.' }, format: { type: 'string', enum: ['text', 'fdx'], description: 'text (default) or fdx for Final Draft XML.' } }, required: ['text'] } },
  { name: 'get_plan', description: 'What a run would make and what it would cost, without starting anything. Always call this and show the person before start_run.', inputSchema: { type: 'object', properties: { depth: { type: 'string', enum: ['quick', 'standard'] }, includeFrames: { type: 'boolean' }, pricePerImageUsd: { type: 'number', description: 'What one picture costs the person, in dollars.' }, budgetUsd: { type: 'number' } } } },
  { name: 'start_run', description: 'Start a run. THIS SPENDS MONEY. It works only if the person has switched on "Let connected agents start runs" in the app, the budget is within the limit they set there, and you pass confirm: true after showing them get_plan. The run stops at the budget. By default it stops after the first concepts for the person to approve.', inputSchema: { type: 'object', properties: { confirm: { type: 'boolean', description: 'Must be true.' }, pricePerImageUsd: { type: 'number' }, budgetUsd: { type: 'number' }, depth: { type: 'string', enum: ['quick', 'standard'] }, includeFrames: { type: 'boolean' }, stopAfterConcepts: { type: 'boolean', description: 'Default true: stop so the person can approve each concept.' } }, required: ['confirm', 'pricePerImageUsd', 'budgetUsd'] } },
  { name: 'continue_run', description: 'Carry on after the run stopped at the concepts, once the person has approved them in the app.', inputSchema: { type: 'object', properties: {} } },
  { name: 'stop_run', description: 'Stop the run. Pictures already being made finish; nothing new starts.', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_report', description: 'The report of a finished or stopped run: what was made, approved, waiting, failed and why, and an estimate of the cost.', inputSchema: { type: 'object', properties: {} } },
]

/** Where the app writes its port and access code. */
export function configPath(env = process.env, platform = process.platform) {
  if (env.PRODUCTION_ONE_AGENT_FILE) return env.PRODUCTION_ONE_AGENT_FILE
  const id = 'com.productionguy.studio'
  if (platform === 'win32') return join(env.APPDATA || join(homedir(), 'AppData', 'Roaming'), id, 'agent.json')
  if (platform === 'darwin') return join(homedir(), 'Library', 'Application Support', id, 'agent.json')
  return join(env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), id, 'agent.json')
}

async function callApp(tool, args) {
  let cfg
  try { cfg = JSON.parse(readFileSync(configPath(), 'utf8')) } catch { return { ok: false, error: 'Production One is not accepting agents. Open the app, go to Assistant, open "Connected agents" and switch on "Let agents connect".' } }
  try {
    const response = await fetch(`http://127.0.0.1:${cfg.port}/call`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.token}` }, body: JSON.stringify({ tool, args: args ?? {} }), signal: AbortSignal.timeout(620000) })
    const body = await response.json().catch(() => ({ ok: false, error: `The app answered ${response.status}` }))
    if (!response.ok) return { ok: false, error: body.error || `The app answered ${response.status}` }
    return body
  } catch (e) { return { ok: false, error: `Could not reach Production One: ${e instanceof Error ? e.message : String(e)}. Is the app open, with "Let agents connect" on?` } }
}

export async function handle(message) {
  const { id, method, params } = message
  const result = (r) => ({ jsonrpc: '2.0', id, result: r })
  const error = (code, text) => ({ jsonrpc: '2.0', id, error: { code, message: text } })
  if (method === 'initialize') return result({ protocolVersion: params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: SERVER })
  if (method === 'ping') return result({})
  if (method === 'tools/list') return result({ tools: TOOLS })
  if (method === 'tools/call') {
    const tool = TOOLS.find((t) => t.name === params?.name)
    if (!tool) return error(-32602, `Unknown tool ${params?.name}`)
    const answer = await callApp(tool.name, params?.arguments)
    const text = JSON.stringify(answer.ok === false ? { error: answer.error } : (answer.result ?? answer), null, 2)
    return result({ content: [{ type: 'text', text }], isError: answer.ok === false })
  }
  if (id === undefined) return null // a notification: no answer
  return error(-32601, `Method not found: ${method}`)
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('production-one-mcp.mjs')) {
  const rl = createInterface({ input: process.stdin })
  rl.on('line', async (line) => {
    if (!line.trim()) return
    let message
    try { message = JSON.parse(line) } catch { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n'); return }
    const reply = await handle(message)
    if (reply) process.stdout.write(JSON.stringify(reply) + '\n')
  })
}
