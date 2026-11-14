import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, CircleAlert, PauseCircle, Play, ShieldCheck } from 'lucide-react'
import { buildDepartmentPlan, type DepartmentAssignment } from '../domain/agentDepartment'
import type { AnalysisResult } from '../domain/productionStudio'
import type { QueueState } from '../domain/generationQueue'

export function AgentDepartmentBoard({ analysis, queue, audit, styleLocked, notify }: { analysis: AnalysisResult; queue: QueueState; audit: { ready: boolean; missingAssets: string[]; incompleteShots: string[] }; styleLocked: boolean; notify: (message: string) => void }) {
  const plan = useMemo(() => buildDepartmentPlan(analysis, queue, audit, styleLocked), [analysis, queue, audit, styleLocked])
  const [expanded, setExpanded] = useState<string | null>('orchestrator')
  const [proposed, setProposed] = useState<Set<string>>(new Set())
  const propose = (assignment: DepartmentAssignment) => { setProposed((current) => new Set(current).add(assignment.role)); notify(`${assignment.title} proposal is ready for director approval.`) }
  const icon = (status: DepartmentAssignment['status']) => status === 'complete' ? <CheckCircle2 size={15} /> : status === 'blocked' ? <CircleAlert size={15} /> : status === 'waiting-approval' ? <PauseCircle size={15} /> : <Play size={15} />
  return <section className="panel agent-board" aria-label="Agent department board">
    <div className="agent-board-head"><div><span className="eyebrow">SUPERVISED DEPARTMENT</span><h3>Agent Department Board</h3><p className="helper">Typed proposals, visible dependencies, and director approval at every creative gate.</p></div><span className="agent-board-mode"><ShieldCheck size={14} /> Supervised</span></div>
    <div className="agent-list">{plan.map((assignment) => <article className={`agent-row ${assignment.status}`} key={assignment.role}>
      <button className="agent-toggle" aria-expanded={expanded === assignment.role} onClick={() => setExpanded(expanded === assignment.role ? null : assignment.role)}><span className="agent-status">{icon(assignment.status)} {assignment.status.replace('-', ' ')}</span><strong>{assignment.title}</strong><ChevronDown size={15} /></button>
      {expanded === assignment.role && <div className="agent-detail"><p>{assignment.brief}</p><small><b>Evidence:</b> {assignment.evidence.length ? assignment.evidence.join(' · ') : 'None yet'}<br /><b>Dependencies:</b> {assignment.dependencies.join(' · ')}<br /><b>Cost:</b> {assignment.cost}</small><div className="agent-actions"><span>{proposed.has(assignment.role) ? 'Proposal awaiting approval' : assignment.nextAction}</span>{assignment.status !== 'complete' && <button className="secondary" onClick={() => propose(assignment)}><Play size={13} /> Propose task</button>}</div></div>}
    </article>)}</div>
  </section>
}
