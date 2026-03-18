import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { DependencyGraph } from './components/DependencyGraph'
import { AnalysisPanel } from './components/AnalysisPanel'
import { CoverageMatrix } from './components/CoverageMatrix'
import { PipelineView } from './components/PipelineView'
import { TestDashboard } from './components/TestDashboard'
import { GitDiffViewer } from './components/GitDiffViewer'
import { SpecBrowser } from './components/SpecBrowser'
import { SpecPage } from './components/SpecPage'

type View = 'graph' | 'specs' | 'analysis' | 'coverage' | 'pipelines' | 'tests' | 'diff'

function App() {
    const [view, setView] = useState<View>('graph')
    const [selectedSpec, setSelectedSpec] = useState<string | null>(null)
    const [specCount, setSpecCount] = useState(0)

    const selectSpec = (name: string) => {
        setSelectedSpec(name)
        setView('specs')
    }

    return (
        <>
            {/* Sidebar */}
            <nav style={{
                width: 220,
                background: '#161b22',
                borderRight: '1px solid #30363d',
                padding: '16px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                flexShrink: 0,
            }}>
                <h1 style={{ fontSize: 16, fontWeight: 700, color: '#58a6ff', marginBottom: 12 }}>
                    viberail-ui
                </h1>
                <NavButton active={view === 'graph' && !selectedSpec} onClick={() => { setView('graph'); setSelectedSpec(null) }}>
                    Dependency Graph
                </NavButton>
                <NavButton active={view === 'specs'} onClick={() => { setView('specs'); setSelectedSpec(null) }}>
                    Specs
                </NavButton>
                <NavButton active={view === 'pipelines'} onClick={() => { setView('pipelines'); setSelectedSpec(null) }}>
                    Pipelines
                </NavButton>
                <NavButton active={view === 'coverage'} onClick={() => { setView('coverage'); setSelectedSpec(null) }}>
                    Coverage Matrix
                </NavButton>
                <NavButton active={view === 'analysis'} onClick={() => { setView('analysis'); setSelectedSpec(null) }}>
                    Analysis
                </NavButton>
                <NavButton active={view === 'tests'} onClick={() => { setView('tests'); setSelectedSpec(null) }}>
                    Test Results
                </NavButton>
                <NavButton active={view === 'diff'} onClick={() => { setView('diff'); setSelectedSpec(null) }}>
                    Spec Diff
                </NavButton>
                <div style={{ marginTop: 'auto', fontSize: 12, color: '#484f58' }}>
                    {specCount > 0 && `${specCount} specs loaded`}
                </div>
            </nav>

            {/* Main content */}
            <main style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
                {view === 'specs' && selectedSpec && (
                    <SpecPage
                        specName={selectedSpec}
                        onBack={() => setSelectedSpec(null)}
                    />
                )}
                {view === 'specs' && !selectedSpec && (
                    <SpecBrowser onSelectSpec={selectSpec} />
                )}
                {view === 'graph' && (
                    <DependencyGraph
                        onSelectSpec={selectSpec}
                        onSpecCount={setSpecCount}
                    />
                )}
                {view === 'pipelines' && (
                    <PipelineView onSelectSpec={selectSpec} />
                )}
                {view === 'coverage' && (
                    <CoverageMatrix onSelectSpec={selectSpec} />
                )}
                {view === 'analysis' && (
                    <AnalysisPanel />
                )}
                {view === 'tests' && (
                    <TestDashboard />
                )}
                {view === 'diff' && (
                    <GitDiffViewer />
                )}
            </main>
        </>
    )
}

function NavButton({ active, onClick, children }: {
    active: boolean
    onClick: () => void
    children: React.ReactNode
}) {
    return (
        <button
            onClick={onClick}
            style={{
                background: active ? '#21262d' : 'transparent',
                border: active ? '1px solid #30363d' : '1px solid transparent',
                color: active ? '#c9d1d9' : '#8b949e',
                padding: '8px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
            }}
        >
            {children}
        </button>
    )
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
