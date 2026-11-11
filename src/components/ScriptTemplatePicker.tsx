import { useState } from 'react'
import { Copy, FileText } from 'lucide-react'
import { scriptTemplates, type ScriptTemplateKind } from '../domain/scriptTemplates'

export function ScriptTemplatePicker({ onUse, notify }: { onUse: (text: string) => void; notify: (message: string) => void }) {
  const [kind, setKind] = useState<ScriptTemplateKind>('screenplay')
  const template = scriptTemplates.find((item) => item.kind === kind) ?? scriptTemplates[0]
  const copy = async () => { try { await navigator.clipboard.writeText(template.example); notify(`${template.label} copied to the clipboard.`) } catch { notify('Could not copy the template; select the example text manually.') } }
  return <section className="script-template" aria-label="Script templates"><div className="script-template-head"><div><span className="eyebrow">START WITH THE RIGHT SHAPE</span><h4><FileText size={15} /> Script template</h4></div><select aria-label="Choose script template" value={kind} onChange={(event) => setKind(event.target.value as ScriptTemplateKind)}>{scriptTemplates.map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}</select></div><p><b>Best for:</b> {template.bestFor}</p><p className="helper">{template.guidance}</p><pre>{template.example}</pre><div className="button-row"><button className="secondary" onClick={() => void copy()}><Copy size={14} /> Copy example</button><button className="secondary" onClick={() => onUse(template.example)}>Use as starting point</button></div><small className="helper">Using a template is optional. Imported scripts are never rewritten without your action.</small></section>
}
