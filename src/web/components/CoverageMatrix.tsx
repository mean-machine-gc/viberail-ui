import { useEffect, useState } from 'react'

type SerializedSpec = {
    exportName: string
    modulePath: string
    shouldFailWith: Record<string, { description: string; exampleCount: number; examples: Array<{ description: string }>; coveredBy?: string }>
    shouldSucceedWith: Record<string, { description: string; exampleCount: number; examples: Array<{ description: string }> }>
    shouldAssert: Record<string, Record<string, { description: string }>>
}

type SpecsData = { specs: SerializedSpec[]; count: number }

type CellStatus = 'covered' | 'covered-by' | 'missing' | 'na'

export function CoverageMatrix({ onSelectSpec }: { onSelectSpec: (name: string) => void }) {
    const [specs, setSpecs] = useState<SerializedSpec[]>([])
    const [loading, setLoading] = useState(true)
    const [hoveredCell, setHoveredCell] = useState<{ spec: string; group: string; kind: string } | null>(null)
    const [showOnly, setShowOnly] = useState<'all' | 'gaps'>('all')

    useEffect(() => {
        fetch('/api/specs')
            .then(r => r.json())
            .then((d: SpecsData) => { setSpecs(d.specs); setLoading(false) })
            .catch(() => setLoading(false))
    }, [])

    if (loading) return <div style={{ padding: 32, color: '#8b949e' }}>Loading coverage matrix...</div>

    // Build matrix rows: one per spec, columns = failure groups + success groups
    const rows = specs.map(spec => {
        const failCols = Object.entries(spec.shouldFailWith).map(([key, g]) => ({
            key,
            kind: 'failure' as const,
            status: (g.coveredBy ? 'covered-by' : g.exampleCount > 0 ? 'covered' : 'missing') as CellStatus,
            description: g.description,
            exampleCount: g.exampleCount,
            coveredBy: g.coveredBy,
            examples: g.examples,
        }))
        const successCols = Object.entries(spec.shouldSucceedWith).map(([key, g]) => {
            const assertions = spec.shouldAssert[key] || {}
            const assertCount = Object.keys(assertions).length
            return {
                key,
                kind: 'success' as const,
                status: (g.exampleCount > 0 ? 'covered' : 'missing') as CellStatus,
                description: g.description,
                exampleCount: g.exampleCount,
                assertCount,
                examples: g.examples,
            }
        })
        const totalGroups = failCols.length + successCols.length
        const coveredGroups = [...failCols, ...successCols].filter(c => c.status === 'covered' || c.status === 'covered-by').length
        return {
            spec,
            failCols,
            successCols,
            totalGroups,
            coveredGroups,
            coverage: totalGroups > 0 ? coveredGroups / totalGroups : 1,
        }
    })

    const filteredRows = showOnly === 'gaps'
        ? rows.filter(r => r.coverage < 1)
        : rows

    const totalMissing = rows.reduce((sum, r) =>
        sum + [...r.failCols, ...r.successCols].filter(c => c.status === 'missing').length, 0)
    const totalGroups = rows.reduce((sum, r) => sum + r.totalGroups, 0)

    return (
        <div style={{ padding: 24 }}>
            {/* Header */}
            <div style={{
                display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20,
                padding: '12px 16px', background: '#161b22', borderRadius: 8,
                border: '1px solid #30363d',
            }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#f0f6fc' }}>Coverage Matrix</span>
                <span style={{ fontSize: 13, color: '#8b949e' }}>{specs.length} specs</span>
                <span style={{
                    fontSize: 12, padding: '3px 8px', borderRadius: 12,
                    background: totalMissing > 0 ? '#3d1f1f' : '#1a3a2a',
                    color: totalMissing > 0 ? '#f85149' : '#7ee787', fontWeight: 600,
                }}>
                    {totalMissing} gap{totalMissing !== 1 ? 's' : ''} / {totalGroups} groups
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <FilterBtn active={showOnly === 'all'} onClick={() => setShowOnly('all')}>All</FilterBtn>
                    <FilterBtn active={showOnly === 'gaps'} onClick={() => setShowOnly('gaps')}>Gaps only</FilterBtn>
                </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 12, color: '#8b949e' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CellDot status="covered" /> Covered
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CellDot status="covered-by" /> Covered by step
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CellDot status="missing" /> Missing
                </span>
            </div>

            {/* Matrix */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredRows.map(row => (
                    <div key={row.spec.exportName} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 12px', background: '#161b22', borderRadius: 6,
                        border: '1px solid #21262d',
                    }}>
                        {/* Spec name */}
                        <button
                            onClick={() => onSelectSpec(row.spec.exportName)}
                            style={{
                                background: 'none', border: 'none', color: '#58a6ff',
                                fontFamily: 'monospace', fontSize: 12, cursor: 'pointer',
                                textAlign: 'left', minWidth: 220, flexShrink: 0,
                                textDecoration: 'none',
                            }}
                            onMouseOver={e => (e.currentTarget.style.textDecoration = 'underline')}
                            onMouseOut={e => (e.currentTarget.style.textDecoration = 'none')}
                        >
                            {row.spec.exportName}
                        </button>

                        {/* Coverage bar */}
                        <div style={{
                            width: 40, height: 4, background: '#21262d', borderRadius: 2,
                            overflow: 'hidden', flexShrink: 0,
                        }}>
                            <div style={{
                                width: `${row.coverage * 100}%`, height: '100%',
                                background: row.coverage === 1 ? '#7ee787' : row.coverage >= 0.5 ? '#ffa657' : '#f85149',
                                borderRadius: 2,
                            }} />
                        </div>

                        {/* Failure cells */}
                        {row.failCols.map(col => (
                            <div
                                key={col.key}
                                onMouseEnter={() => setHoveredCell({ spec: row.spec.exportName, group: col.key, kind: 'failure' })}
                                onMouseLeave={() => setHoveredCell(null)}
                                style={{ position: 'relative' }}
                            >
                                <CellDot status={col.status} />
                                {hoveredCell?.spec === row.spec.exportName && hoveredCell?.group === col.key && (
                                    <Tooltip>
                                        <div style={{ color: '#f85149', fontWeight: 600, marginBottom: 4 }}>{col.key}</div>
                                        <div>{col.description}</div>
                                        <div style={{ marginTop: 4 }}>
                                            {col.coveredBy
                                                ? <span style={{ color: '#58a6ff' }}>Covered by: {col.coveredBy}</span>
                                                : <span>{col.exampleCount} example{col.exampleCount !== 1 ? 's' : ''}</span>
                                            }
                                        </div>
                                    </Tooltip>
                                )}
                            </div>
                        ))}

                        {/* Separator */}
                        {row.failCols.length > 0 && row.successCols.length > 0 && (
                            <div style={{ width: 1, height: 12, background: '#30363d', flexShrink: 0 }} />
                        )}

                        {/* Success cells */}
                        {row.successCols.map(col => (
                            <div
                                key={col.key}
                                onMouseEnter={() => setHoveredCell({ spec: row.spec.exportName, group: col.key, kind: 'success' })}
                                onMouseLeave={() => setHoveredCell(null)}
                                style={{ position: 'relative' }}
                            >
                                <CellDot status={col.status} success />
                                {hoveredCell?.spec === row.spec.exportName && hoveredCell?.group === col.key && (
                                    <Tooltip>
                                        <div style={{ color: '#7ee787', fontWeight: 600, marginBottom: 4 }}>{col.key}</div>
                                        <div>{col.description}</div>
                                        <div style={{ marginTop: 4 }}>
                                            {col.exampleCount} example{col.exampleCount !== 1 ? 's' : ''},
                                            {' '}{col.assertCount} assertion{col.assertCount !== 1 ? 's' : ''}
                                        </div>
                                    </Tooltip>
                                )}
                            </div>
                        ))}

                        {/* Coverage % */}
                        <span style={{
                            marginLeft: 'auto', fontSize: 11, fontFamily: 'monospace',
                            color: row.coverage === 1 ? '#7ee787' : row.coverage >= 0.5 ? '#ffa657' : '#f85149',
                        }}>
                            {Math.round(row.coverage * 100)}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function CellDot({ status, success }: { status: CellStatus; success?: boolean }) {
    const colors: Record<CellStatus, string> = {
        'covered': success ? '#7ee787' : '#58a6ff',
        'covered-by': '#d2a8ff',
        'missing': '#f85149',
        'na': '#30363d',
    }
    return (
        <span style={{
            display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
            background: colors[status],
            border: status === 'missing' ? '1px solid #f8514966' : 'none',
            flexShrink: 0,
        }} />
    )
}

function Tooltip({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            background: '#1c2128', border: '1px solid #30363d', borderRadius: 6,
            padding: '8px 12px', fontSize: 11, color: '#c9d1d9',
            whiteSpace: 'nowrap', zIndex: 100, pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
            {children}
        </div>
    )
}

function FilterBtn({ active, onClick, children }: {
    active: boolean; onClick: () => void; children: React.ReactNode
}) {
    return (
        <button onClick={onClick} style={{
            background: active ? '#21262d' : 'transparent',
            border: active ? '1px solid #30363d' : '1px solid transparent',
            color: active ? '#c9d1d9' : '#484f58',
            padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
        }}>
            {children}
        </button>
    )
}
