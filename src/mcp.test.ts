// @vitest-environment node
import { spawn } from 'node:child_process'
import { createServer, type IncomingMessage } from 'node:http'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AGENT_TOOLS } from './domain/agentTools'

const script = resolve(process.cwd(), 'tools/mcp/production-one-mcp.mjs')

/** Starts the MCP server, sends it lines, and collects what it answers. */
function run(env: Record<string, string>, lines: object[]): Promise<Array<Record<string, any>>> {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [script], { env: { ...process.env, ...env } })
    let out = ''
    child.stdout.on('data', (d) => { out += d })
    child.on('error', fail)
    child.on('close', () => done(out.split('\n').filter(Boolean).map((l) => JSON.parse(l))))
    for (const l of lines) child.stdin.write(JSON.stringify(l) + '\n')
    child.stdin.end()
  })
}

const readBody = (req: IncomingMessage) => new Promise<string>((r) => { let b = ''; req.on('data', (d) => { b += d }); req.on('end', () => r(b)) })

describe('the MCP server', () => {
  it('speaks MCP: initialises, lists exactly the app\'s tools with schemas, and ignores notifications', async () => {
    const replies = await run({ PRODUCTION_ONE_AGENT_FILE: join(tmpdir(), 'nothing-here.json') }, [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '1' } } },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { jsonrpc: '2.0', id: 3, method: 'ping' },
      { jsonrpc: '2.0', id: 4, method: 'nope' },
    ])
    expect(replies).toHaveLength(4)
    expect(replies[0].result).toMatchObject({ protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'production-one' } })
    const tools = replies[1].result.tools as Array<{ name: string; description: string; inputSchema: { type: string } }>
    expect(tools.map((t) => t.name)).toEqual([...AGENT_TOOLS])
    for (const t of tools) { expect(t.description.length).toBeGreaterThan(20); expect(t.inputSchema.type).toBe('object') }
    expect(tools.find((t) => t.name === 'start_run')!.description).toMatch(/SPENDS MONEY/)
    expect(replies[2].result).toEqual({})
    expect(replies[3].error.code).toBe(-32601)
  })

  it('says how to turn the door on when the app is not accepting agents', async () => {
    const replies = await run({ PRODUCTION_ONE_AGENT_FILE: join(tmpdir(), 'nothing-here.json') }, [{ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_status', arguments: {} } }])
    expect(replies[0].result.isError).toBe(true)
    expect(replies[0].result.content[0].text).toMatch(/Let agents connect/)
  })

  it('sends a tool call to the app with the access code, and hands back the answer; a refusal comes back as an error', async () => {
    const seen: Array<{ auth: string | undefined; body: any }> = []
    const server = createServer(async (req, res) => {
      const body = JSON.parse(await readBody(req))
      seen.push({ auth: req.headers.authorization, body })
      const reply = body.tool === 'start_run' ? { ok: false, error: 'The person has not allowed connected agents to start runs.' } : { ok: true, result: { phase: 'idle', items: 3 } }
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(reply))
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const port = (server.address() as { port: number }).port
    const file = join(mkdtempSync(join(tmpdir(), 'po-mcp-')), 'agent.json')
    writeFileSync(file, JSON.stringify({ port, token: 'secret-code' }))
    try {
      const replies = await run({ PRODUCTION_ONE_AGENT_FILE: file }, [
        { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_status', arguments: {} } },
        { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'start_run', arguments: { confirm: true, pricePerImageUsd: 0.1, budgetUsd: 3 } } },
        { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'delete_everything', arguments: {} } },
      ])
      const byId = (id: number) => replies.find((r) => r.id === id)!
      expect(seen.find((x) => x.body.tool === 'get_status')).toMatchObject({ auth: 'Bearer secret-code' })
      expect(JSON.parse(byId(1).result.content[0].text)).toEqual({ phase: 'idle', items: 3 })
      expect(byId(1).result.isError).toBe(false)
      expect(seen.find((x) => x.body.tool === 'start_run')!.body).toEqual({ tool: 'start_run', args: { confirm: true, pricePerImageUsd: 0.1, budgetUsd: 3 } })
      expect(byId(2).result.isError).toBe(true)
      expect(byId(2).result.content[0].text).toMatch(/not allowed connected agents/)
      expect(byId(3).error.code).toBe(-32602)
      expect(seen).toHaveLength(2)
    } finally { server.close() }
  })
})
