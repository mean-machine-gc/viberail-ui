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
            navbar={{ width: 220, breakpoint: 0 }}
            padding={0}
        >
            <AppShell.Navbar p="sm">
                <AppShell.Section>
                    <Group justify="space-between" mb="sm" px="xs">
                        <Text fw={700} c="blue" size="sm">viberail-ui</Text>
                        <ColorSchemeToggle />
                    </Group>
                </AppShell.Section>

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
