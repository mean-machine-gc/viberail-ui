import { useEffect, useState } from 'react'

type GitRef = { hash: string; message: string }
type RefData = { branches: string[]; commits: GitRef[]; currentBranch: string }

type SpecChange = {
    exportName: string
    modulePath: string
    failuresAdded: string[]
    failuresRemoved: string[]
    successesAdded: string[]
    successesRemoved: string[]
    assertionsAdded: string[]
    assertionsRemoved: string[]
    stepsAdded: string[]
    stepsRemoved: string[]
    exampleCountChanges: Array<{ group: string; from: number; to: number }>
}

type SpecDiff = {
    added: Array<{ exportName: string; modulePath: string }>
    removed: Array<{ exportName: string; modulePath?: string }>
    changed: SpecChange[]
    unchanged: number
}

type DiffResult = { ref: string; diff: SpecDiff }

export function GitDiffViewer() {
    const [refs, setRefs] = useState<RefData | null>(null)
    const [selectedRef, setSelectedRef] = useState<string>('')
    const [diffResult, setDiffResult] = useState<DiffResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [refType, setRefType] = useState<'branch' | 'commit'>('commit')

    useEffect(() => {
        fetch('/api/git/refs')
            .then(r => r.json())
            .then(d => setRefs(d))
            .catch(() => setError('Failed to load git refs'))
    }, [])

    const runDiff = () => {
        if (!selectedRef) return
        setLoading(true)
        setError(null)
        setDiffResult(null)
        fetch(`/api/git/diff/${encodeURIComponent(selectedRef)}`)
            .then(r => r.json())
            .then(d => {
                if (d.error) { setError(d.error); setLoading(false); return }
                setDiffResult(d)
                setLoading(false)
            })
            .catch(err => { setError(err.message); setLoading(false) })
    }

    return (
        <div style={{ padding: 24 }}>
            {/* Header */}
            <div style={{
                padding: '12px 16px', background: '#161b22', borderRadius: 8,
                border: '1px solid #30363d', marginBottom: 20,
            }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f6fc', marginBottom: 12 }}>
                    Spec Diff
                </div>
                <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 12 }}>
                    Compare current specs against a previous git ref.
                    {refs && <span> On branch <code style={{ color: '#58a6ff' }}>{refs.currentBranch}</code></span>}
                </div>

                {/* Ref selector */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                        <TabBtn active={refType === 'commit'} onClick={() => { setRefType('commit'); setSelectedRef('') }}>
                            Commits
                        </TabBtn>
                        <TabBtn active={refType === 'branch'} onClick={() => { setRefType('branch'); setSelectedRef('') }}>
                            Branches
                        </TabBtn>
                    </div>

                    <select
                        value={selectedRef}
                        onChange={e => setSelectedRef(e.target.value)}
                        style={{
                            flex: 1, background: '#0d1117', border: '1px solid #30363d',
                            color: '#c9d1d9', padding: '6px 10px', borderRadius: 6, fontSize: 12,
                            fontFamily: 'monospace',
                        }}
                    >
                        <option value="">Select a {refType}...</option>
                        {refType === 'commit' && refs?.commits.map(c => (
                            <option key={c.hash} value={c.hash}>{c.hash} {c.message}</option>
                        ))}
                        {refType === 'branch' && refs?.branches
                            .filter(b => b !== refs.currentBranch)
                            .map(b => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                    </select>

                    <button
                        onClick={runDiff}
                        disabled={!selectedRef || loading}
                        style={{
                            background: selectedRef && !loading ? '#238636' : '#21262d',
                            color: selectedRef && !loading ? '#fff' : '#484f58',
                            border: 'none', padding: '6px 16px', borderRadius: 6,
                            cursor: selectedRef && !loading ? 'pointer' : 'default',
                            fontSize: 12, fontWeight: 600,
                        }}
                    >
                        {loading ? 'Loading...' : 'Compare'}
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div style={{
                    padding: 12, background: '#3d1f1f', borderRadius: 6, border: '1px solid #f85149',
                    color: '#f85149', fontSize: 12, marginBottom: 16,
                }}>
                    {error}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div style={{ padding: 32, textAlign: 'center', color: '#8b949e' }}>
                    Loading specs from <code style={{ color: '#58a6ff' }}>{selectedRef}</code>...
                    <div style={{ fontSize: 11, color: '#484f58', marginTop: 4 }}>
                        Creating worktree and loading spec files
                    </div>
                </div>
            )}

            {/* Results */}
            {diffResult && <DiffResults diff={diffResult.diff} ref={diffResult.ref} />}
        </div>
    )
}

function DiffResults({ diff, ref }: { diff: SpecDiff; ref: string }) {
    const totalChanges = diff.added.length + diff.removed.length + diff.changed.length

    if (totalChanges === 0) {
        return (
            <div style={{ padding: 32, textAlign: 'center', color: '#7ee787', fontSize: 14 }}>
                No spec changes since <code style={{ color: '#58a6ff' }}>{ref.substring(0, 8)}</code>
                <div style={{ fontSize: 12, color: '#484f58', marginTop: 4 }}>
                    {diff.unchanged} specs unchanged
                </div>
            </div>
        )
    }

    return (
        <div>
            {/* Summary */}
            <div style={{
                display: 'flex', gap: 12, marginBottom: 16, fontSize: 12,
                padding: '8px 12px', background: '#161b22', borderRadius: 6, border: '1px solid #21262d',
            }}>
                <span style={{ color: '#8b949e' }}>
                    Comparing with <code style={{ color: '#58a6ff' }}>{ref.substring(0, 8)}</code>
                </span>
                {diff.added.length > 0 && (
                    <DiffBadge count={diff.added.length} label="added" color="#7ee787" bg="#1a3a2a" />
                )}
                {diff.removed.length > 0 && (
                    <DiffBadge count={diff.removed.length} label="removed" color="#f85149" bg="#3d1f1f" />
                )}
                {diff.changed.length > 0 && (
                    <DiffBadge count={diff.changed.length} label="changed" color="#ffa657" bg="#3d2f1a" />
                )}
                <span style={{ color: '#484f58' }}>{diff.unchanged} unchanged</span>
            </div>

            {/* Added specs */}
            {diff.added.length > 0 && (
                <DiffSection title="Added Specs" color="#7ee787">
                    {diff.added.map(s => (
                        <div key={s.exportName} style={diffRowStyle}>
                            <span style={{ color: '#7ee787', fontWeight: 600 }}>+</span>
                            <code style={{ fontSize: 12, color: '#7ee787' }}>{s.exportName}</code>
                            <span style={{ fontSize: 11, color: '#484f58' }}>{s.modulePath}</span>
                        </div>
                    ))}
                </DiffSection>
            )}

            {/* Removed specs */}
            {diff.removed.length > 0 && (
                <DiffSection title="Removed Specs" color="#f85149">
                    {diff.removed.map(s => (
                        <div key={s.exportName} style={diffRowStyle}>
                            <span style={{ color: '#f85149', fontWeight: 600 }}>-</span>
                            <code style={{ fontSize: 12, color: '#f85149' }}>{s.exportName}</code>
                            {s.modulePath && <span style={{ fontSize: 11, color: '#484f58' }}>{s.modulePath}</span>}
                        </div>
                    ))}
                </DiffSection>
            )}

            {/* Changed specs */}
            {diff.changed.length > 0 && (
                <DiffSection title="Changed Specs" color="#ffa657">
                    {diff.changed.map(change => (
                        <ChangeDetail key={change.exportName} change={change} />
                    ))}
                </DiffSection>
            )}
        </div>
    )
}

function ChangeDetail({ change }: { change: SpecChange }) {
    return (
        <div style={{
            background: '#161b22', borderRadius: 6, border: '1px solid #21262d',
            padding: '10px 14px', marginBottom: 6,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ color: '#ffa657', fontWeight: 600 }}>~</span>
                <code style={{ fontSize: 13, color: '#ffa657' }}>{change.exportName}</code>
                <span style={{ fontSize: 11, color: '#484f58' }}>{change.modulePath}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 16 }}>
                {change.failuresAdded.map(f => (
                    <DiffLine key={`+f-${f}`} type="+" label="failure" value={f} />
                ))}
                {change.failuresRemoved.map(f => (
                    <DiffLine key={`-f-${f}`} type="-" label="failure" value={f} />
                ))}
                {change.successesAdded.map(s => (
                    <DiffLine key={`+s-${s}`} type="+" label="success" value={s} />
                ))}
                {change.successesRemoved.map(s => (
                    <DiffLine key={`-s-${s}`} type="-" label="success" value={s} />
                ))}
                {change.assertionsAdded.map(a => (
                    <DiffLine key={`+a-${a}`} type="+" label="assertion" value={a} />
                ))}
                {change.assertionsRemoved.map(a => (
                    <DiffLine key={`-a-${a}`} type="-" label="assertion" value={a} />
                ))}
                {change.stepsAdded.map(s => (
                    <DiffLine key={`+st-${s}`} type="+" label="step" value={s} />
                ))}
                {change.stepsRemoved.map(s => (
                    <DiffLine key={`-st-${s}`} type="-" label="step" value={s} />
                ))}
                {change.exampleCountChanges.map(c => (
                    <div key={`ex-${c.group}`} style={{ display: 'flex', gap: 6, fontSize: 11, alignItems: 'center' }}>
                        <span style={{ color: '#ffa657', width: 12 }}>~</span>
                        <span style={{ color: '#484f58', minWidth: 60 }}>examples</span>
                        <code style={{ color: '#c9d1d9' }}>{c.group}</code>
                        <span style={{ color: '#f85149' }}>{c.from}</span>
                        <span style={{ color: '#484f58' }}>→</span>
                        <span style={{ color: '#7ee787' }}>{c.to}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function DiffLine({ type, label, value }: { type: '+' | '-'; label: string; value: string }) {
    const color = type === '+' ? '#7ee787' : '#f85149'
    return (
        <div style={{ display: 'flex', gap: 6, fontSize: 11, alignItems: 'center' }}>
            <span style={{ color, width: 12, fontWeight: 600 }}>{type}</span>
            <span style={{ color: '#484f58', minWidth: 60 }}>{label}</span>
            <code style={{ color }}>{value}</code>
        </div>
    )
}

function DiffSection({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color, marginBottom: 8 }}>{title}</h3>
            {children}
        </div>
    )
}

function DiffBadge({ count, label, color, bg }: { count: number; label: string; color: string; bg: string }) {
    return (
        <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 10,
            background: bg, color, fontWeight: 600,
        }}>
            {count} {label}
        </span>
    )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

const diffRowStyle: React.CSSProperties = {
    display: 'flex', gap: 8, alignItems: 'center', padding: '6px 12px',
    background: '#161b22', borderRadius: 6, border: '1px solid #21262d',
    marginBottom: 4,
}
