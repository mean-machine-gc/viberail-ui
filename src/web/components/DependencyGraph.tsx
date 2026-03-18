import { useEffect, useRef, useState } from 'react'
import type { Core } from 'cytoscape'

type GraphNode = { id: string; name: string; specPath: string; domain: string; edgeCount: number }
type GraphEdge = { source: string; target: string | null; stepName: string; type: string }
type GraphData = { nodes: GraphNode[]; edges: GraphEdge[] }

// Domain colors — distinct hues for subgraph grouping
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
    }, [])

    useEffect(() => {
        if (!data || !containerRef.current) return

        // Dynamic import to avoid SSR issues
        Promise.all([
            import('cytoscape'),
            import('cytoscape-dagre'),
        ]).then(([cytoscapeMod, dagreMod]) => {
            const cytoscape = cytoscapeMod.default
            const dagre = dagreMod.default

            cytoscape.use(dagre)

            // Build elements — compound nodes for domains
            const elements: any[] = []

            // Domain parent nodes
            const domainSet = new Set(data.nodes.map(n => n.domain))
            for (const domain of domainSet) {
                elements.push({
                    data: { id: `domain_${domain}`, label: domain.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ') },
                    classes: 'domain',
                })
            }

            // Spec nodes
            for (const node of data.nodes) {
                elements.push({
                    data: {
                        id: node.id,
                        label: node.name,
                        parent: `domain_${node.domain}`,
                        domain: node.domain,
                        specName: node.name,
                        edgeCount: node.edgeCount,
                    },
                    classes: node.edgeCount > 0 ? 'composed' : 'atomic',
                })
            }

            // Edges — only those with resolved targets
            for (const edge of data.edges) {
                if (!edge.target) continue
                elements.push({
                    data: {
                        source: edge.source,
                        target: edge.target,
                        label: edge.stepName,
                        edgeType: edge.type,
                    },
                })
            }

            const cy = cytoscape({
                container: containerRef.current,
                elements,
                style: [
                    {
                        selector: 'node.composed',
                        style: {
                            'background-color': (ele: any) => domainColor(ele.data('domain')),
                            'label': 'data(label)',
                            'text-valign': 'center',
                            'text-halign': 'center',
                            'color': '#fff',
                            'font-size': 10,
                            'font-weight': 600,
                            'width': 30,
                            'height': 30,
                            'border-width': 2,
                            'border-color': '#30363d',
                        },
                    },
                    {
                        selector: 'node.atomic',
                        style: {
                            'background-color': (ele: any) => domainColor(ele.data('domain')),
                            'label': 'data(label)',
                            'text-valign': 'center',
                            'text-halign': 'center',
                            'color': '#fff',
                            'font-size': 9,
                            'width': 24,
                            'height': 24,
                            'opacity': 0.8,
                            'border-width': 1,
                            'border-color': '#30363d',
                        },
                    },
                    {
                        selector: 'node.domain',
                        style: {
                            'background-color': '#161b22',
                            'background-opacity': 0.6,
                            'border-width': 1,
                            'border-color': '#30363d',
                            'label': 'data(label)',
                            'text-valign': 'top',
                            'text-halign': 'center',
                            'color': '#8b949e',
                            'font-size': 11,
                            'font-weight': 600,
                            'padding': '20px',
                        },
                    },
                    {
                        selector: 'edge',
                        style: {
                            'width': 1.5,
                            'line-color': '#30363d',
                            'target-arrow-color': '#30363d',
                            'target-arrow-shape': 'triangle',
                            'curve-style': 'bezier',
                            'label': 'data(label)',
                            'font-size': 8,
                            'color': '#484f58',
                            'text-rotation': 'autorotate',
                            'text-margin-y': -8,
                        },
                    },
                    {
                        selector: 'edge[edgeType="dep"]',
                        style: {
                            'line-style': 'dashed',
                            'line-dash-pattern': [6, 3],
                            'line-color': '#484f58',
                            'target-arrow-color': '#484f58',
                        },
                    },
                    {
                        selector: 'edge[edgeType="safe-dep"]',
                        style: {
                            'line-color': '#7ee787',
                            'target-arrow-color': '#7ee787',
                        },
                    },
                    {
                        selector: 'node:active, node:selected',
                        style: {
                            'border-color': '#f0f6fc',
                            'border-width': 3,
                        },
                    },
                ],
                layout: {
                    name: 'dagre',
                    rankDir: 'LR',
                    nodeSep: 60,
                    rankSep: 100,
                    padding: 30,
                } as any,
                minZoom: 0.2,
                maxZoom: 3,
            })

            // Click handler
            cy.on('tap', 'node.composed, node.atomic', (evt) => {
                const specName = evt.target.data('specName')
                if (specName) {
                    // Find the exportName from the spec data
                    fetch(`/api/specs`)
                        .then(r => r.json())
                        .then(data => {
                            const spec = data.specs.find((s: any) =>
                                s.modulePath.includes(specName)
                            )
                            if (spec) onSelectSpec(spec.exportName)
                        })
                }
            })

            // Hover effects
            cy.on('mouseover', 'node.composed, node.atomic', (evt) => {
                evt.target.style('border-color', '#f0f6fc')
                evt.target.style('border-width', 3)
                containerRef.current!.style.cursor = 'pointer'
                // Highlight connected edges
                evt.target.connectedEdges().style({
                    'line-color': '#58a6ff',
                    'target-arrow-color': '#58a6ff',
                    'width': 2.5,
                })
            })
            cy.on('mouseout', 'node.composed, node.atomic', (evt) => {
                evt.target.style('border-color', '#30363d')
                evt.target.style('border-width', evt.target.hasClass('composed') ? 2 : 1)
                containerRef.current!.style.cursor = 'default'
                evt.target.connectedEdges().forEach((edge: any) => {
                    const isDepEdge = edge.data('edgeType') === 'dep'
                    const isSafeDep = edge.data('edgeType') === 'safe-dep'
                    edge.style({
                        'line-color': isSafeDep ? '#7ee787' : isDepEdge ? '#484f58' : '#30363d',
                        'target-arrow-color': isSafeDep ? '#7ee787' : isDepEdge ? '#484f58' : '#30363d',
                        'width': 1.5,
                    })
                })
            })

            cyRef.current = cy
        })

        return () => {
            cyRef.current?.destroy()
        }
    }, [data])

    if (loading) {
        return <div style={{ padding: 32, color: '#8b949e' }}>Loading dependency graph...</div>
    }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Legend */}
            <div style={{
                padding: '8px 16px',
                borderBottom: '1px solid #30363d',
                display: 'flex',
                gap: 16,
                alignItems: 'center',
                fontSize: 12,
                color: '#8b949e',
                flexShrink: 0,
            }}>
                <span style={{ fontWeight: 600, color: '#c9d1d9' }}>Dependency Graph</span>
                {domains.map(d => (
                    <span key={d} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: domainColor(d), display: 'inline-block',
                        }} />
                        {d}
                    </span>
                ))}
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 16, borderTop: '2px solid #7ee787', display: 'inline-block' }} />
                    safe-dep
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 16, borderTop: '2px dashed #484f58', display: 'inline-block' }} />
                    dep
                </span>
            </div>
            {/* Graph container */}
            <div ref={containerRef} style={{ flex: 1 }} />
        </div>
    )
}
