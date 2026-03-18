import '@mantine/core/styles.css'
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { MantineProvider, AppShell, NavLink, Text, ActionIcon, Group, useMantineColorScheme } from '@mantine/core'
import { Sun, Moon, Graph, ListBullets, GitDiff, ChartBar, FlowArrow, TestTube, Table } from '@phosphor-icons/react'
import { theme } from './theme'
import { DependencyGraph } from './components/DependencyGraph'
import { AnalysisPanel } from './components/AnalysisPanel'
import { CoverageMatrix } from './components/CoverageMatrix'
import { PipelineView } from './components/PipelineView'
import { TestDashboard } from './components/TestDashboard'
import { GitDiffViewer } from './components/GitDiffViewer'
import { SpecBrowser } from './components/SpecBrowser'
import { SpecPage } from './components/SpecPage'

type View = 'graph' | 'specs' | 'analysis' | 'coverage' | 'pipelines' | 'tests' | 'diff'

const NAV_ITEMS: Array<{ view: View; label: string; icon: typeof Graph }> = [
    { view: 'graph', label: 'Dependency Graph', icon: Graph },
    { view: 'specs', label: 'Specs', icon: ListBullets },
    { view: 'pipelines', label: 'Pipelines', icon: FlowArrow },
    { view: 'coverage', label: 'Coverage Matrix', icon: Table },
    { view: 'analysis', label: 'Analysis', icon: ChartBar },
    { view: 'tests', label: 'Test Results', icon: TestTube },
    { view: 'diff', label: 'Spec Diff', icon: GitDiff },
]

function VibeRailLogo({ size = 55 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="-70 10 396 246" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* === Circuit traces — left side === */}
            {/* Top — kinks up */}
            <polyline points="40,80 18,80 2,68 -30,68" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <circle cx="-36" cy="68" r="14" fill="currentColor" />
            {/* Middle — straight out, longer */}
            <polyline points="40,120 -46,120" stroke="currentColor" strokeWidth="16" strokeLinecap="round" fill="none" />
            <circle cx="-52" cy="120" r="16" fill="currentColor" />
            {/* Bottom — kinks down (mirrors top) */}
            <polyline points="40,160 18,160 2,172 -30,172" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <circle cx="-36" cy="172" r="14" fill="currentColor" />

            {/* === Circuit traces — right side === */}
            {/* Top — kinks up */}
            <polyline points="216,80 238,80 254,68 286,68" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <circle cx="292" cy="68" r="14" fill="currentColor" />
            {/* Middle — straight out, longer */}
            <polyline points="216,120 302,120" stroke="currentColor" strokeWidth="16" strokeLinecap="round" fill="none" />
            <circle cx="308" cy="120" r="16" fill="currentColor" />
            {/* Bottom — kinks down (mirrors top) */}
            <polyline points="216,160 238,160 254,172 286,172" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <circle cx="292" cy="172" r="14" fill="currentColor" />

            {/* Visor band */}
            <path d="M208,72v56H48V72Z" fill="currentColor" opacity="0.15" />

            {/* Train body — Phosphor Train duotone outline (no eyes/smile) */}
            <path
                d="M184,24H72A32,32,0,0,0,40,56V184a32,32,0,0,0,32,32h8L65.6,235.2a8,8,0,1,0,12.8,9.6L100,216h56l21.6,28.8a8,8,0,1,0,12.8-9.6L176,216h8a32,32,0,0,0,32-32V56A32,32,0,0,0,184,24Z
                 M56,120V80h64v40Z m80-40h64v40H136Z
                 M72,40H184a16,16,0,0,1,16,16v8H56V56A16,16,0,0,1,72,40Z
                 M184,200H72a16,16,0,0,1-16-16V136H200v48A16,16,0,0,1,184,200Z
                 M96,172a12,12,0,1,1-12-12A12,12,0,0,1,96,172Z m88,0a12,12,0,1,1-12-12A12,12,0,0,1,184,172Z"
                fill="currentColor"
            />
        </svg>
    )
}

function ColorSchemeToggle() {
    const { colorScheme, toggleColorScheme } = useMantineColorScheme()
    return (
        <ActionIcon variant="subtle" size="lg" onClick={toggleColorScheme} aria-label="Toggle color scheme">
            {colorScheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </ActionIcon>
    )
}

function App() {
    const [view, setView] = useState<View>('graph')
    const [selectedSpec, setSelectedSpec] = useState<string | null>(null)
    const [specCount, setSpecCount] = useState(0)

    const selectSpec = (name: string) => {
        setSelectedSpec(name)
        setView('specs')
    }

    const navigate = (v: View) => {
        setView(v)
        setSelectedSpec(null)
    }

    return (
        <AppShell
            header={{ height: 50 }}
            navbar={{ width: 220, breakpoint: 0 }}
            padding={0}
        >
            <AppShell.Header>
                <Group justify="space-between" h="100%" px="md">
                    <Group gap={6} align="center">
                        <VibeRailLogo />
                        <Text
                            component="span"
                            ff="monospace"
                            fw={800}
                            size="lg"
                            style={{ letterSpacing: '-0.5px' }}
                        >
                            <span style={{ color: 'var(--mantine-color-violet-5)' }}>Vibe</span>
                            <span style={{ color: 'var(--mantine-color-cyan-5)' }}>Rail</span>
                        </Text>
                        <Text component="span" size="xs" c="dimmed" fw={500}>
                            UI
                        </Text>
                    </Group>
                    <ColorSchemeToggle />
                </Group>
            </AppShell.Header>

            <AppShell.Navbar p="sm">
                <AppShell.Section grow>
                    {NAV_ITEMS.map(({ view: v, label, icon: Icon }) => (
                        <NavLink
                            key={v}
                            label={label}
                            leftSection={<Icon size={16} />}
                            active={view === v}
                            onClick={() => navigate(v)}
                            variant="light"
                        />
                    ))}
                </AppShell.Section>

                <AppShell.Section>
                    {specCount > 0 && (
                        <Text size="xs" c="dimmed" px="xs" py="sm">
                            {specCount} specs loaded
                        </Text>
                    )}
                </AppShell.Section>
            </AppShell.Navbar>

            <AppShell.Main style={{ height: '100vh', overflow: 'auto' }}>
                {view === 'specs' && selectedSpec && (
                    <SpecPage specName={selectedSpec} onBack={() => setSelectedSpec(null)} />
                )}
                {view === 'specs' && !selectedSpec && (
                    <SpecBrowser onSelectSpec={selectSpec} />
                )}
                {view === 'graph' && (
                    <DependencyGraph onSelectSpec={selectSpec} onSpecCount={setSpecCount} />
                )}
                {view === 'pipelines' && (
                    <PipelineView onSelectSpec={selectSpec} />
                )}
                {view === 'coverage' && (
                    <CoverageMatrix onSelectSpec={selectSpec} />
                )}
                {view === 'analysis' && <AnalysisPanel />}
                {view === 'tests' && <TestDashboard />}
                {view === 'diff' && <GitDiffViewer />}
            </AppShell.Main>
        </AppShell>
    )
}

const root = createRoot(document.getElementById('root')!)
root.render(
    <MantineProvider theme={theme} defaultColorScheme="dark">
        <App />
    </MantineProvider>
)
