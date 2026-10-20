import { useEffect, useMemo, useState } from 'react'
import { Boxes, Check, ChevronRight, Clapperboard, FolderKanban, PackageCheck, PenTool, Search, Sparkles, WandSparkles } from 'lucide-react'
import { BrandMark } from './components/BrandMark'
import { projectStore } from './data/projectStore'
import { demoGraph } from './domain/demoGraph'
import { dependentsOf, reviseNode, type NodeKind, type ProductionGraph } from './domain/productionGraph'
import './styles.css'

const workspaces = [
  { name: 'Projects', icon: FolderKanban }, { name: 'Story', icon: PenTool }, { name: 'Design', icon: Sparkles },
  { name: 'Direct', icon: Clapperboard, optional: true }, { name: 'Deliver', icon: PackageCheck },
]

const labels: Record<NodeKind, string> = { project: 'Project', scene: 'Scene', shot: 'Shot', asset: 'Asset', storyVariant: 'Story variant', sheet: 'Sheet', revision: 'Revision' }

export default function App() {
  const [workspace, setWorkspace] = useState('Design')
  const [graph, setGraph] = useState<ProductionGraph>(() => structuredClone(demoGraph))
  const [hydrated, setHydrated] = useState(false)
  const [selectedId, setSelectedId] = useState('ASSE-AMINA-001')
  const [notice, setNotice] = useState('')
  const selected = graph.nodes.find((node) => node.id === selectedId) ?? graph.nodes[0]
  const affected = useMemo(() => dependentsOf(graph, selected.id), [graph, selected.id])
  const counts = useMemo(() => ({ approved: graph.nodes.filter((n) => n.status === 'approved').length, stale: graph.nodes.filter((n) => n.status === 'stale').length }), [graph])

  useEffect(() => { projectStore.load().then((saved) => { setGraph(saved); setHydrated(true) }) }, [])
  useEffect(() => { if (hydrated) void projectStore.save(graph) }, [graph, hydrated])

  const createRevision = () => {
    const next = reviseNode(graph, selected.id)
    setGraph(next)
    setNotice(`${selected.name} advanced to revision ${selected.revision + 1}. ${affected.length} dependent output${affected.length === 1 ? '' : 's'} flagged for review.`)
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><BrandMark size={38} /><div><strong>Production Guy</strong><span>Your AI Production Department</span></div></div>
      <nav aria-label="Primary workspaces">{workspaces.map(({ name, icon: Icon, optional }) => <button key={name} className={workspace === name ? 'active' : ''} onClick={() => setWorkspace(name)}><Icon size={18}/><span>{name}</span>{optional && <em>Optional</em>}</button>)}</nav>
      <div className="project-card"><span>Current production</span><strong>The Last Horizon</strong><small>12 min short film · autosaved</small><div className="progress"><i /></div><small>Production ready · 33%</small></div>
      <div className="user"><div>OE</div><span><strong>Creative Studio</strong><small>Local workspace</small></span></div>
    </aside>

    <main>
      <header><div><span className="eyebrow">THE LAST HORIZON / {workspace.toUpperCase()}</span><h1>{workspace === 'Design' ? 'Production Design' : workspace}</h1></div><div className="header-actions"><label><Search size={15}/><input aria-label="Search production" placeholder="Search production…" /></label><button className="icon-button" title="Generation tools"><WandSparkles size={18}/></button></div></header>

      <section className="hero">
        <div className="hero-copy"><span className="pill">RELEASE 1 · FOUNDATION</span><h2>Every creative decision,<br/>connected.</h2><p>The Production Graph keeps scenes, shots, assets, variants, sheets, and revisions traceable from first concept to final delivery.</p><div className="hero-actions"><button className="primary" onClick={() => setWorkspace('Story')}>Continue story analysis <ChevronRight size={16}/></button><button className="secondary" onClick={() => setWorkspace('Deliver')}>Review inventory</button></div></div>
        <div className="hero-visual"><div className="frame"><img src="/assets/amina-reference.png" alt="Amina expedition visual reference"/><span>APPROVED REFERENCE · CHAR-001</span></div><div className="floating-card"><Check size={15}/><span><b>Identity locked</b><small>Continuity protected</small></span></div></div>
      </section>

      {notice && <div className="notice" role="status"><Check size={16}/>{notice}<button onClick={() => setNotice('')}>Dismiss</button></div>}

      <section className="workspace-grid">
        <div className="panel inventory"><div className="panel-heading"><div><span className="eyebrow">CANONICAL REGISTRY</span><h3>Production Graph</h3></div><span className="metric"><b>{graph.nodes.length}</b> nodes</span></div>
          <div className="graph-list">{graph.nodes.filter((n) => n.kind !== 'project').map((node) => <button key={node.id} onClick={() => setSelectedId(node.id)} className={selected.id === node.id ? 'selected' : ''}><span className={`kind ${node.kind}`}>{labels[node.kind].slice(0, 2)}</span><span><b>{node.name}</b><small>{node.id}</small></span><i className={node.status}>{node.status}</i></button>)}</div>
        </div>
        <div className="panel detail"><div className="panel-heading"><div><span className="eyebrow">{labels[selected.kind].toUpperCase()} · {selected.id}</span><h3>{selected.name}</h3></div><span className={`status ${selected.status}`}>{selected.status}</span></div>
          <div className="meta-grid"><div><span>Stable ID</span><b>{selected.id}</b></div><div><span>Revision</span><b>v{String(selected.revision).padStart(2,'0')}</b></div>{Object.entries(selected.metadata).map(([key,value]) => <div key={key}><span>{key}</span><b>{String(value)}</b></div>)}</div>
          <div className="impact"><div><Boxes size={20}/><span><b>Dependency impact</b><small>{affected.length ? `${affected.length} downstream item${affected.length === 1 ? '' : 's'} will be flagged if this changes.` : 'No downstream outputs depend on this item.'}</small></span></div>{affected.map((node) => <div className="impact-row" key={node.id}><span>{labels[node.kind]}</span><b>{node.name}</b><em>{node.status}</em></div>)}</div>
          <button className="primary full" onClick={createRevision}>Create revision & flag dependents</button>
        </div>
        <div className="panel summary"><span className="eyebrow">PRODUCTION HEALTH</span><h3>Coverage at a glance</h3><div className="big-stat"><b>33%</b><span>ready for production</span></div><div className="stat-row"><span>Approved</span><b>{counts.approved}</b></div><div className="stat-row"><span>Needs review</span><b>{counts.stale}</b></div><div className="stat-row"><span>Storyboarding</span><b className="muted">Not enabled</b></div><p>Storyboards stay optional. Enable Direct when the production is ready for shot planning.</p><button className="secondary full" onClick={() => setWorkspace('Direct')}>Open Director’s Room</button></div>
      </section>
    </main>
  </div>
}
