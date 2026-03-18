import { useEffect, useRef, useState } from 'react'
import { useSpecRevision } from '../hooks/useSpecRevision'
import { Group, Text, Loader, ColorSwatch, useMantineTheme, useMantineColorScheme } from '@mantine/core'
import { useDiagramColors } from '../hooks/useDiagramColors'
import type { Core } from 'cytoscape'

type GraphNode = { id: string; name: string; specPath: string; domain: string; edgeCount: number }
type GraphEdge = { source: string; target: string | null; stepName: string; type: string }
type GraphData = { nodes: GraphNode[]; edges: GraphEdge[] }

const DOMAIN_COLORS: Record<string, string> = {}
const PALETTE = ['#58a6ff', '#f78166', '#7ee787', '#d2a8ff', '#79c0ff', '#ffa657', '#ff7b72', '#a5d6ff']
let colorIdx = 0
function domainColor(domain: string): string {
    if (!DOMAIN_COLORS[domain]) {
        DOMAIN_COLORS[domain] = PALETTE[colorIdx % PALETTE.length]
        colorIdx++
    }
    return DOMAIN_COLORS[domain]
}

export function DependencyGraph({ onSelectSpec, onSpecCount }: {
    onSelectSpec: (name: string) => void
    onSpecCount: (count: number) => void
}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const cyRef = useRef<Core | null>(null)
    const [data, setData] = useState<GraphData | null>(null)
    const [loading, setLoading] = useState(true)
    const [domains, setDomains] = useState<string[]>([])
    const revision = useSpecRevision()
    const theme = useMantineTheme()
    const { colorScheme } = useMantineColorScheme()

    useEffect(() => {
        fetch('/api/graph')
            .then(r => r.json())
            .then((d: GraphData) => {
                setData(d)
                setLoading(false)
                onSpecCount(d.nodes.length)
                const uniqueDomains = [...new Set(d.nodes.map(n => n.domain))]
                setDomains(uniqueDomains)
            })
            .catch(err => {
                console.error('Failed to load graph:', err)
                setLoading(false)
            })
    }, [revision])

    useEffect(() => {
        if (!data || !containerRef.current) return

        const isDark = colorScheme === 'dark'
        const borderColor = isDark ? theme.colors.dark[4] : theme.colors.gray[4]
        const surfaceBg = isDark ? theme.colors.dark[7] : theme.colors.gray[0]
        const textColor = isDark ? theme.colors.gray[3] : theme.colors.dark[7]
        const mutedText = isDark ? theme.colors.dark[2] : theme.colors.gray[6]
        const edgeMuted = isDark ? theme.colors.dark[3] : theme.colors.gray[5]
        const highlightBorder = isDark ? theme.colors.gray[0] : theme.colors.dark[9]
        const greenEdge = theme.colors.green[5]

        Promise.all([
            import('cytoscape'),
            import('cytoscape-dagre'),
        ]).then(([cytoscapeMod, dagreMod]) => {
            const cytoscape = cytoscapeMod.default
            const dagre = dagreMod.default

            cytoscape.use(dagre)

            const elements: any[] = []
            const domainSet = new Set(data.nodes.map(n => n.domain))
            for (const domain of domainSet) {
                elements.push({
                    data: { id: `domain_${domain}`, label: domain.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ') },
                    classes: 'domain',
                })
            }

            for (const node of data.nodes) {
                elements.push({
                    data: { id: node.id, label: node.name, parent: `domain_${node.domain}`, domain: node.domain, specName: node.name, edgeCount: node.edgeCount },
                    classes: node.edgeCount > 0 ? 'composed' : 'atomic',
                })
            }

            for (const edge of data.edges) {
                if (!edge.target) continue
                elements.push({
                    data: { source: edge.source, target: edge.target, label: edge.stepName, edgeType: edge.type },
                })
            }

            const cy = cytoscape({
                container: containerRef.current,
                elements,
                style: [
                    {
                        selector: 'node.composed',
                        style: {
                            'shape': 'roundrectangle',
                            'background-color': surfaceBg,
                            'border-color': (ele: any) => domainColor(ele.data('domain')),
                            'border-width': 1.5,
                            'label': 'data(label)',
                            'text-valign': 'center', 'text-halign': 'center',
                            'color': textColor,
                            'font-size': 10, 'font-weight': 600, 'font-family': 'monospace',
                            'width': 'label', 'height': 'label',
                            'padding': '10px',
                        },
                    },
                    {
                        selector: 'node.atomic',
                        style: {
                            'shape': 'roundrectangle',
                            'background-color': surfaceBg,
                            'border-color': (ele: any) => domainColor(ele.data('domain')),
                            'border-width': 1,
                            'label': 'data(label)',
                            'text-valign': 'center', 'text-halign': 'center',
                            'color': textColor,
                            'font-size': 9, 'font-family': 'monospace',
                            'opacity': 0.85,
                            'width': 'label', 'height': 'label',
                            'padding': '8px',
                        },
                    },
                    {
                        selector: 'node.domain',
                        style: {
                            'background-color': surfaceBg, 'background-opacity': 0.4,
                            'border-width': 1, 'border-color': borderColor,
                            'shape': 'roundrectangle',
                            'label': 'data(label)', 'text-valign': 'top', 'text-halign': 'center',
                            'color': mutedText, 'font-size': 11, 'font-weight': 600, 'padding': '20px',
                        },
                    },
                    {
                        selector: 'edge',
                        style: {
                            'width': 1.5, 'line-color': borderColor, 'target-arrow-color': borderColor,
                            'target-arrow-shape': 'triangle', 'curve-style': 'bezier',
                            'label': 'data(label)', 'font-size': 8, 'color': edgeMuted,
                            'text-rotation': 'autorotate', 'text-margin-y': -8,
                        },
                    },
                    {
                        selector: 'edge[edgeType="dep"]',
                        style: { 'line-style': 'dashed', 'line-dash-pattern': [6, 3], 'line-color': edgeMuted, 'target-arrow-color': edgeMuted },
                    },
                    {
                        selector: 'edge[edgeType="safe-dep"]',
                        style: { 'line-color': greenEdge, 'target-arrow-color': greenEdge },
                    },
                    {
                        selector: 'node:active, node:selected',
                        style: { 'border-color': highlightBorder, 'border-width': 3 },
                    },
                ],
                layout: { name: 'dagre', rankDir: 'TB', nodeSep: 60, rankSep: 80, padding: 30 } as any,
                minZoom: 0.2, maxZoom: 3,
            })

            cy.on('tap', 'node.composed, node.atomic', (evt) => {
                const specName = evt.target.data('specName')
                if (specName) {
                    fetch(`/api/specs`)
                        .then(r => r.json())
                        .then(data => {
                            const spec = data.specs.find((s: any) => s.modulePath.includes(specName))
                            if (spec) onSelectSpec(spec.exportName)
                        })
                }
            })

            cy.on('mouseover', 'node.composed, node.atomic', (evt) => {
                evt.target.style('border-color', highlightBorder)
                evt.target.style('border-width', 3)
                containerRef.current!.style.cursor = 'pointer'
                evt.target.connectedEdges().style({ 'line-color': theme.colors.blue[5], 'target-arrow-color': theme.colors.blue[5], 'width': 2.5 })
            })
            cy.on('mouseout', 'node.composed, node.atomic', (evt) => {
                evt.target.style('border-color', domainColor(evt.target.data('domain')))
                evt.target.style('border-width', evt.target.hasClass('composed') ? 1.5 : 1)
                containerRef.current!.style.cursor = 'default'
                evt.target.connectedEdges().forEach((edge: any) => {
                    const isDepEdge = edge.data('edgeType') === 'dep'
                    const isSafeDep = edge.data('edgeType') === 'safe-dep'
                    edge.style({
                        'line-color': isSafeDep ? greenEdge : isDepEdge ? edgeMuted : borderColor,
                        'target-arrow-color': isSafeDep ? greenEdge : isDepEdge ? edgeMuted : borderColor,
                        'width': 1.5,
                    })
                })
            })

            cyRef.current = cy
        })

        return () => { cyRef.current?.destroy() }
    }, [data, colorScheme])

    if (loading) return <Group p="xl"><Loader size="sm" /><Text c="dimmed">Loading dependency graph...</Text></Group>

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Group px="md" py="xs" gap="md"
                style={{ borderBottom: '1px solid var(--mantine-color-default-border)', flexShrink: 0 }}
            >
                <Text fw={600} size="sm">Dependency Graph</Text>
                {domains.map(d => (
                    <Group key={d} gap={4}>
                        <ColorSwatch size={10} color={domainColor(d)} />
                        <Text size="xs" c="dimmed">{d}</Text>
                    </Group>
                ))}
                <Group gap={4}>
                    <span style={{ width: 16, borderTop: `2px solid ${theme.colors.green[5]}`, display: 'inline-block' }} />
                    <Text size="xs" c="dimmed">safe-dep</Text>
                </Group>
                <Group gap={4}>
                    <span style={{ width: 16, borderTop: `2px dashed ${theme.colors.dark[3]}`, display: 'inline-block' }} />
                    <Text size="xs" c="dimmed">dep</Text>
                </Group>
            </Group>
            <div ref={containerRef} style={{ flex: 1 }} />
        </div>
    )
}
