import { useMemo, useState, type ReactElement } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, CircleAlert, Hourglass, PauseCircle } from 'lucide-react'
import type { AnalysisResult } from '../domain/productionStudio'
import type { QueueState } from '../domain/generationQueue'
import { buildTaskList, groupTasks, type TaskAction, type TaskGroup, type TaskItem } from '../domain/taskList'

const icon: Record<TaskGroup, ReactElement> = {
  'needs-approval': <PauseCircle size={15} aria-hidden="true" />,
  running: <Hourglass size={15} aria-hidden="true" />,
  blocked: <CircleAlert size={15} aria-hidden="true" />,
  complete: <CheckCircle2 size={15} aria-hidden="true" />,
}

/**
 * The work to be done, by role, grouped by where it stands. Each line gives the role, what it is about, why it is where it is, and a button to the place the work
 * is done. Longer detail (the brief, the evidence, what it waits on) opens under the line. Nothing here starts a job; the person does the work.
 */
export function TaskList(props: { analysis: AnalysisResult; queue: QueueState; audit: { ready: boolean; missingAssets: string[]; incompleteShots: string[] }; styleLocked: boolean; onAct: (action: TaskAction) => void }) {
  const { analysis, queue, audit, styleLocked, onAct } = props
  const tasks = useMemo(() => buildTaskList(analysis, queue, audit, styleLocked), [analysis, queue, audit, styleLocked])
  const groups = useMemo(() => groupTasks(tasks), [tasks])
  const [openRow, setOpenRow] = useState<string | null>(null)
  const row = (t: TaskItem) => {
    const open = openRow === t.role
    return (
      <li key={t.role} className={`tl-row ${t.group}`}>
        <div className="tl-line">
          <b className="tl-role">{t.title}</b>
          <span className="tl-target">{t.target}</span>
          <span className="tl-reason">{t.reason}</span>
          <span className="tl-next">
            {t.action ? <button className="secondary" onClick={() => onAct(t.action!)}>{t.action.label}</button> : <small>{t.next}</small>}
          </span>
          <button className="icon-button tl-more" aria-expanded={open} aria-label={`Details for ${t.title}`} onClick={() => setOpenRow(open ? null : t.role)}>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
        </div>
        {open && (
          <div className="tl-drawer" role="region" aria-label={`${t.title} details`}>
            <p>{t.drawer.brief}</p>
            <dl>
              <div><dt>Next</dt><dd>{t.next}</dd></div>
              <div><dt>Evidence</dt><dd>{t.drawer.evidence.length ? t.drawer.evidence.join(' · ') : 'None yet'}</dd></div>
              <div><dt>Waits on</dt><dd>{t.drawer.dependencies.join(' · ')}</dd></div>
              <div><dt>Cost</dt><dd>{t.drawer.cost}</dd></div>
            </dl>
          </div>
        )}
      </li>
    )
  }
  return (
    <section className="panel tl" aria-label="Tasks">
      <header className="tl-head"><h3>Tasks</h3><p>{groups.map((g) => `${g.tasks.length} ${g.label.toLowerCase()}`).join(' · ')}</p></header>
      {groups.map((g) => {
        const body = <ul className="tl-list">{g.tasks.map(row)}</ul>
        return g.id === 'complete'
          ? <details className="tl-group" key={g.id}><summary>{icon[g.id]} {g.label} <span className="tl-n">{g.tasks.length}</span></summary>{body}</details>
          : <div className="tl-group" key={g.id} role="group" aria-label={g.label}><h4>{icon[g.id]} {g.label} <span className="tl-n">{g.tasks.length}</span></h4>{body}</div>
      })}
    </section>
  )
}
