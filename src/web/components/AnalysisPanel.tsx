import { useEffect, useState } from 'react'

type CheckResult = {
    specFile: string
    specName: string
    check: string
    severity: 'error' | 'warning'
    message: string
}

type AnalysisData = {
    results: CheckResult[]
    summary: { errors: number; warnings: number; specCount: number }
}

export function AnalysisPanel() {
    const [data, setData] = useState<AnalysisData | null>(null)
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'error' | 'warning'>('all')
    const [checkFilter, setCheckFilter] = useState<string>('all')

    useEffect(() => {
        fetch('/api/analysis')
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false) })
            .catch(() => setLoading(false))
    }, [])

    if (loading) return <div style={{ padding: 32, color: '#8b949e' }}>Running checks...</div>
    if (!data) return <div style={{ padding: 32, color: '#f85149' }}>Failed to load analysis</div>

    const filtered = data.results.filter(r => {
        if (filter !== 'all' && r.severity !== filter) return false
        if (checkFilter !== 'all' && r.check !== checkFilter) return false
        return true
    })

    // Group by file
    const byFile = new Map<string, CheckResult[]>()
    for (const r of filtered) {
        const list = byFile.get(r.specFile) || []
        list.push(r)
        byFile.set(r.specFile, list)
    }

    // Unique check names
    const checkNames = [...new Set(data.results.map(r => r.check))]

    return (
        <div style={{ padding: 24, maxWidth: 1000 }}>
            {/* Summary bar */}
            <div style={{
                display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20,
                padding: '12px 16px', background: '#161b22', borderRadius: 8,
                border: '1px solid #30363d',
            }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#f0f6fc' }}>Analysis</span>
                <span style={{ fontSize: 13, color: '#8b949e' }}>{data.summary.specCount} specs</span>
                <SummaryBadge count={data.summary.errors} severity="error" />
                <SummaryBadge count={data.summary.warnings} severity="warning" />

                {/* Filters */}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterButton>
                    <FilterButton active={filter === 'error'} onClick={() => setFilter('error')}>Errors</FilterButton>
                    <FilterButton active={filter === 'warning'} onClick={() => setFilter('warning')}>Warnings</FilterButton>
                </div>
            </div>

            {/* Check type filter */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                <FilterButton active={checkFilter === 'all'} onClick={() => setCheckFilter('all')}>
                    all checks
                </FilterButton>
                {checkNames.map(name => (
                    <FilterButton key={name} active={checkFilter === name} onClick={() => setCheckFilter(name)}>
                        {name}
                    </FilterButton>
                ))}
            </div>

            {/* Results grouped by file */}
            {filtered.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#7ee787', fontSize: 14 }}>
                    No issues found
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[...byFile.entries()].map(([file, results]) => (
                        <div key={file} style={{
                            background: '#161b22', borderRadius: 8, border: '1px solid #21262d',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                padding: '8px 14px', borderBottom: '1px solid #21262d',
                                fontSize: 12, fontFamily: 'monospace', color: '#8b949e',
                            }}>
                                {file}
                            </div>
                            {results.map((r, i) => (
                                <div key={i} style={{
                                    padding: '6px 14px', display: 'flex', gap: 10, alignItems: 'center',
                                    borderBottom: i < results.length - 1 ? '1px solid #21262d' : 'none',
                                    fontSize: 13,
                                }}>
                                    <SeverityBadge severity={r.severity} />
                                    <span style={{ color: '#484f58', fontSize: 11, minWidth: 160, fontFamily: 'monospace' }}>
                                        {r.check}
                                    </span>
                                    <span style={{ color: '#c9d1d9' }}>{r.message}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function SummaryBadge({ count, severity }: { count: number; severity: 'error' | 'warning' }) {
    const colors = severity === 'error'
        ? { bg: '#3d1f1f', fg: '#f85149' }
        : { bg: '#3d2f1a', fg: '#ffa657' }
    return (
        <span style={{
            fontSize: 12, padding: '3px 8px', borderRadius: 12,
            background: colors.bg, color: colors.fg, fontWeight: 600,
        }}>
            {count} {severity}{count !== 1 ? 's' : ''}
        </span>
    )
}

function SeverityBadge({ severity }: { severity: 'error' | 'warning' }) {
    const colors = severity === 'error'
        ? { bg: '#3d1f1f', fg: '#f85149' }
        : { bg: '#3d2f1a', fg: '#ffa657' }
    return (
        <span style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 4,
            background: colors.bg, color: colors.fg,
            fontWeight: 600, textTransform: 'uppercase', minWidth: 56, textAlign: 'center',
            display: 'inline-block',
        }}>
            {severity}
        </span>
    )
}

function FilterButton({ active, onClick, children }: {
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
