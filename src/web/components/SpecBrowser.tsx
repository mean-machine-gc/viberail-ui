import { useEffect, useState } from 'react'

type SerializedSpec = {
    exportName: string
    modulePath: string
    steps?: Array<{ name: string }>
    shouldFailWith: Record<string, { exampleCount: number }>
    shouldSucceedWith: Record<string, { exampleCount: number }>
}

type DomainGroup = {
    domain: string
    specs: SerializedSpec[]
}

function extractDomain(modulePath: string): string {
    const match = modulePath.match(/src\/domain\/([^/]+)/)
    return match ? match[1] : 'other'
}

function groupByDomain(specs: SerializedSpec[]): DomainGroup[] {
    const map = new Map<string, SerializedSpec[]>()
    for (const spec of specs) {
        const domain = extractDomain(spec.modulePath)
        if (!map.has(domain)) map.set(domain, [])
        map.get(domain)!.push(spec)
    }
    return [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([domain, specs]) => ({ domain, specs: specs.sort((a, b) => a.exportName.localeCompare(b.exportName)) }))
}

export function SpecBrowser({ onSelectSpec }: { onSelectSpec: (name: string) => void }) {
    const [specs, setSpecs] = useState<SerializedSpec[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

    useEffect(() => {
        fetch('/api/specs')
            .then(r => r.json())
            .then(d => { setSpecs(d.specs || []); setLoading(false) })
            .catch(() => setLoading(false))
    }, [])

    if (loading) return <div style={{ padding: 32, color: '#8b949e' }}>Loading specs...</div>

    const filtered = search
        ? specs.filter(s => s.exportName.toLowerCase().includes(search.toLowerCase()))
        : specs

    const groups = groupByDomain(filtered)

    const toggleDomain = (domain: string) => {
        setCollapsed(prev => {
            const next = new Set(prev)
            next.has(domain) ? next.delete(domain) : next.add(domain)
            return next
        })
    }

    return (
        <div style={{ padding: 24, maxWidth: 900 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f0f6fc', marginBottom: 16 }}>
                Specs
            </h2>

            {/* Search */}
            <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search specs..."
                style={{
                    width: '100%',
                    maxWidth: 400,
                    padding: '8px 12px',
                    background: '#0d1117',
                    border: '1px solid #30363d',
                    borderRadius: 6,
                    color: '#c9d1d9',
                    fontSize: 13,
                    marginBottom: 20,
                    outline: 'none',
                    boxSizing: 'border-box',
                }}
            />

            <div style={{ fontSize: 12, color: '#484f58', marginBottom: 16 }}>
                {filtered.length} spec{filtered.length !== 1 ? 's' : ''} across {groups.length} domain{groups.length !== 1 ? 's' : ''}
            </div>

            {/* Domain groups */}
            {groups.map(({ domain, specs: domainSpecs }) => {
                const isCollapsed = collapsed.has(domain)
                return (
                    <div key={domain} style={{ marginBottom: 16 }}>
                        <button
                            onClick={() => toggleDomain(domain)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#58a6ff',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: 'pointer',
                                padding: '6px 0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                            }}
                        >
                            <span style={{
                                display: 'inline-block',
                                width: 12,
                                fontSize: 10,
                                color: '#484f58',
                                transition: 'transform 0.15s',
                                transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                            }}>▼</span>
                            {domain}
                            <span style={{ fontSize: 11, color: '#484f58', fontWeight: 400 }}>
                                ({domainSpecs.length})
                            </span>
                        </button>
                        {!isCollapsed && (
                            <div style={{
                                marginLeft: 20,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 4,
                                marginTop: 4,
                            }}>
                                {domainSpecs.map(spec => {
                                    const failCount = Object.keys(spec.shouldFailWith).length
                                    const successCount = Object.keys(spec.shouldSucceedWith).length
                                    const isPipeline = !!spec.steps && spec.steps.length > 0
                                    return (
                                        <button
                                            key={spec.exportName}
                                            onClick={() => onSelectSpec(spec.exportName)}
                                            style={{
                                                background: 'transparent',
                                                border: '1px solid transparent',
                                                borderRadius: 6,
                                                padding: '8px 12px',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                color: '#c9d1d9',
                                                fontSize: 13,
                                                transition: 'background 0.1s',
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.background = '#161b22'
                                                e.currentTarget.style.borderColor = '#21262d'
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = 'transparent'
                                                e.currentTarget.style.borderColor = 'transparent'
                                            }}
                                        >
                                            <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>
                                                {spec.exportName}
                                            </span>
                                            <span style={{
                                                fontSize: 10, padding: '2px 6px', borderRadius: 4,
                                                background: isPipeline ? '#1a3a4a' : '#21262d',
                                                color: isPipeline ? '#58a6ff' : '#8b949e',
                                                fontWeight: 600,
                                            }}>
                                                {isPipeline ? `pipeline` : 'atomic'}
                                            </span>
                                            <span style={{ fontSize: 10, color: '#f85149' }}>{failCount}F</span>
                                            <span style={{ fontSize: 10, color: '#7ee787' }}>{successCount}S</span>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
