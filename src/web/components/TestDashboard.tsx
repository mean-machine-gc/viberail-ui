import { useEffect, useState } from 'react'

type ExampleResult = {
    description: string
    status: 'pass' | 'fail' | 'skip'
    duration?: number
    failureMessage?: string
}

type GroupTestResult = {
    status: 'pass' | 'fail' | 'skip' | 'todo' | 'empty'
    examples: ExampleResult[]
}

type SuccessTestResult = GroupTestResult & {
    assertions: Record<string, { description: string; examples: ExampleResult[] }>
}

type SpecTestResult = {
    specName: string
    failures: Record<string, GroupTestResult>
    successes: Record<string, SuccessTestResult>
    totalTests: number
    passed: number
    failed: number
    skipped: number
    todo: number
}

type TestReport = {
    timestamp: string
    duration: number
    totalSpecs: number
    totalTests: number
    passed: number
    failed: number
    skipped: number
    todo: number
    specs: SpecTestResult[]
    error?: string
}

export function TestDashboard() {
    const [report, setReport] = useState<TestReport | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [expandedSpec, setExpandedSpec] = useState<string | null>(null)
    const [filter, setFilter] = useState<'all' | 'failed' | 'skipped'>('all')

    useEffect(() => {
        fetch('/api/test-results')
            .then(r => r.json())
            .then(d => {
                if (d.error) { setError(d.error); setLoading(false); return }
                setReport(d)
                setLoading(false)
            })
            .catch(() => { setError('Failed to fetch test results'); setLoading(false) })
    }, [])

    if (loading) return <div style={{ padding: 32, color: '#8b949e' }}>Loading test results...</div>
    if (error) return (
        <div style={{ padding: 32 }}>
            <div style={{ color: '#ffa657', fontSize: 14, marginBottom: 8 }}>No test results available</div>
            <code style={{ fontSize: 12, color: '#8b949e', display: 'block', padding: 12, background: '#161b22', borderRadius: 6 }}>
                {error}
            </code>
        </div>
    )
    if (!report) return null

    const filteredSpecs = report.specs.filter(s => {
        if (filter === 'failed') return s.failed > 0
        if (filter === 'skipped') return s.skipped > 0 || s.todo > 0
        return true
    })

    const passRate = report.totalTests > 0 ? report.passed / report.totalTests : 0

    return (
        <div style={{ padding: 24 }}>
            {/* Summary header */}
            <div style={{
                display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20,
                padding: '12px 16px', background: '#161b22', borderRadius: 8,
                border: '1px solid #30363d', flexWrap: 'wrap',
            }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#f0f6fc' }}>Test Results</span>

                {/* Pass rate ring */}
                <div style={{ position: 'relative', width: 36, height: 36 }}>
                    <svg width={36} height={36} style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx={18} cy={18} r={14} fill="none" stroke="#21262d" strokeWidth={4} />
                        <circle cx={18} cy={18} r={14} fill="none"
                            stroke={report.failed > 0 ? '#f85149' : '#7ee787'}
                            strokeWidth={4}
                            strokeDasharray={`${passRate * 88} 88`}
                        />
                    </svg>
                    <span style={{
                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 9, fontWeight: 700,
                        color: report.failed > 0 ? '#f85149' : '#7ee787',
                    }}>
                        {Math.round(passRate * 100)}%
                    </span>
                </div>

                <StatBadge label="passed" count={report.passed} color="#7ee787" bg="#1a3a2a" />
                <StatBadge label="failed" count={report.failed} color="#f85149" bg="#3d1f1f" />
                <StatBadge label="skipped" count={report.skipped} color="#d2a8ff" bg="#2a1a3a" />
                {report.todo > 0 && <StatBadge label="todo" count={report.todo} color="#484f58" bg="#21262d" />}

                <span style={{ fontSize: 11, color: '#484f58' }}>
                    {report.totalSpecs} specs · {report.totalTests} tests · {(report.duration / 1000).toFixed(1)}s
                </span>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterBtn>
                    <FilterBtn active={filter === 'failed'} onClick={() => setFilter('failed')}>Failed</FilterBtn>
                    <FilterBtn active={filter === 'skipped'} onClick={() => setFilter('skipped')}>Skipped</FilterBtn>
                </div>
            </div>

            {/* Timestamp */}
            <div style={{ fontSize: 11, color: '#484f58', marginBottom: 16 }}>
                Results from {new Date(report.timestamp).toLocaleString()}
            </div>

            {/* Spec list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filteredSpecs.map(spec => (
                    <SpecRow
                        key={spec.specName}
                        spec={spec}
                        expanded={expandedSpec === spec.specName}
                        onToggle={() => setExpandedSpec(expandedSpec === spec.specName ? null : spec.specName)}
                    />
                ))}
            </div>
        </div>
    )
}

function SpecRow({ spec, expanded, onToggle }: {
    spec: SpecTestResult; expanded: boolean; onToggle: () => void
}) {
    const allPass = spec.failed === 0 && spec.passed > 0
    const hasFailure = spec.failed > 0

    return (
        <div style={{
            background: '#161b22', borderRadius: 6,
            border: `1px solid ${hasFailure ? '#3d1f1f' : '#21262d'}`,
        }}>
            {/* Summary row */}
            <button onClick={onToggle} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left',
            }}>
                <span style={{ fontSize: 12, color: '#484f58', width: 16, textAlign: 'center' }}>
                    {expanded ? '▼' : '▸'}
                </span>

                {/* Status dot */}
                <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: hasFailure ? '#f85149' : allPass ? '#7ee787' : '#ffa657',
                }} />

                <span style={{
                    fontFamily: 'monospace', fontSize: 13,
                    color: hasFailure ? '#f85149' : '#c9d1d9',
                    fontWeight: hasFailure ? 600 : 400,
                }}>
                    {spec.specName}
                </span>

                {/* Mini stats */}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, fontSize: 11 }}>
                    {spec.passed > 0 && <span style={{ color: '#7ee787' }}>{spec.passed} passed</span>}
                    {spec.failed > 0 && <span style={{ color: '#f85149' }}>{spec.failed} failed</span>}
                    {spec.skipped > 0 && <span style={{ color: '#d2a8ff' }}>{spec.skipped} skipped</span>}
                    {spec.todo > 0 && <span style={{ color: '#484f58' }}>{spec.todo} todo</span>}
                </div>
            </button>

            {/* Expanded detail */}
            {expanded && (
                <div style={{ padding: '0 12px 12px 38px' }}>
                    {/* Failures */}
                    {Object.keys(spec.failures).length > 0 && (
                        <GroupSection label="Failures" color="#f85149">
                            {Object.entries(spec.failures).map(([key, group]) => (
                                <GroupDetail key={key} name={key} group={group} color="#f85149" />
                            ))}
                        </GroupSection>
                    )}

                    {/* Successes */}
                    {Object.keys(spec.successes).length > 0 && (
                        <GroupSection label="Successes" color="#7ee787">
                            {Object.entries(spec.successes).map(([key, group]) => (
                                <div key={key}>
                                    <GroupDetail name={key} group={group} color="#7ee787" />
                                    {/* Assertions */}
                                    {Object.keys(group.assertions).length > 0 && (
                                        <div style={{ marginLeft: 16, marginTop: 4 }}>
                                            {Object.entries(group.assertions).map(([aName, assertion]) => (
                                                <div key={aName} style={{ marginBottom: 4 }}>
                                                    <div style={{ fontSize: 11, color: '#d2a8ff', fontFamily: 'monospace', marginBottom: 2 }}>
                                                        assert: {assertion.description}
                                                    </div>
                                                    {assertion.examples.map((ex, i) => (
                                                        <ExampleRow key={i} example={ex} />
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </GroupSection>
                    )}
                </div>
            )}
        </div>
    )
}

function GroupSection({ label, color, children }: {
    label: string; color: string; children: React.ReactNode
}) {
    return (
        <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color, textTransform: 'uppercase', marginBottom: 4 }}>
                {label}
            </div>
            {children}
        </div>
    )
}

function GroupDetail({ name, group, color }: {
    name: string; group: GroupTestResult; color: string
}) {
    return (
        <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <code style={{ fontSize: 11, fontFamily: 'monospace', color }}>{name}</code>
                <StatusBadge status={group.status} />
            </div>
            {group.examples.map((ex, i) => (
                <ExampleRow key={i} example={ex} />
            ))}
        </div>
    )
}

function ExampleRow({ example }: { example: ExampleResult }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: '#8b949e', paddingLeft: 8, marginBottom: 1,
        }}>
            <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: example.status === 'pass' ? '#7ee787' : example.status === 'fail' ? '#f85149' : '#484f58',
            }} />
            <span style={{ color: example.status === 'fail' ? '#f85149' : '#c9d1d9' }}>
                {example.description}
            </span>
            {example.duration != null && (
                <span style={{ fontSize: 10, color: '#484f58' }}>{example.duration}ms</span>
            )}
            {example.failureMessage && (
                <span style={{ fontSize: 10, color: '#f85149', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {example.failureMessage.split('\n')[0]}
                </span>
            )}
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, { bg: string; fg: string }> = {
        pass: { bg: '#1a3a2a', fg: '#7ee787' },
        fail: { bg: '#3d1f1f', fg: '#f85149' },
        skip: { bg: '#2a1a3a', fg: '#d2a8ff' },
        todo: { bg: '#21262d', fg: '#484f58' },
        empty: { bg: '#21262d', fg: '#484f58' },
    }
    const s = styles[status] || styles.empty
    return (
        <span style={{
            fontSize: 9, padding: '1px 5px', borderRadius: 3,
            background: s.bg, color: s.fg, fontWeight: 600, textTransform: 'uppercase',
        }}>
            {status}
        </span>
    )
}

function StatBadge({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) {
    return (
        <span style={{
            fontSize: 12, padding: '3px 8px', borderRadius: 12,
            background: bg, color, fontWeight: 600,
        }}>
            {count} {label}
        </span>
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
