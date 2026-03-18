import { useEffect, useState } from 'react'

type SerializedSpec = {
    exportName: string
    filePath: string
    modulePath: string
    document?: boolean
    steps?: Array<{ name: string; type: string; description: string; handlers?: string[] }>
    shouldFailWith: Record<string, { description: string; exampleCount: number; examples: Array<{ description: string }>; coveredBy?: string }>
    shouldSucceedWith: Record<string, { description: string; exampleCount: number; examples: Array<{ description: string }> }>
    shouldAssert: Record<string, Record<string, { description: string }>>
}

export function SpecDetail({ specName, onBack }: { specName: string; onBack: () => void }) {
    const [spec, setSpec] = useState<SerializedSpec | null>(null)
    const [loading, setLoading] = useState(true)
    const [tracedFailure, setTracedFailure] = useState<string | null>(null)

    useEffect(() => {
        fetch(`/api/spec/${specName}`)
            .then(r => r.json())
            .then(s => { setSpec(s); setLoading(false) })
            .catch(() => setLoading(false))
    }, [specName])

    if (loading) return <div style={{ padding: 32, color: '#8b949e' }}>Loading...</div>
    if (!spec) return <div style={{ padding: 32, color: '#f85149' }}>Spec not found</div>

    const failEntries = Object.entries(spec.shouldFailWith)
    const successEntries = Object.entries(spec.shouldSucceedWith)

    // Build trace data: which steps are highlighted for the traced failure
    const tracedSteps = new Set<string>()
    if (tracedFailure && spec.shouldFailWith[tracedFailure]?.coveredBy) {
        const trail = spec.shouldFailWith[tracedFailure].coveredBy!
        // coveredBy is like "stepA" or "stepA → stepB → stepC"
        for (const part of trail.split(' → ')) {
            tracedSteps.add(part.trim())
        }
    }

    return (
        <div style={{ padding: 24, maxWidth: 960 }}>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <button onClick={onBack} style={backBtnStyle}>&larr; Back to graph</button>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 8, color: '#f0f6fc' }}>
                    {spec.exportName}
                </h2>
                <div style={{ fontSize: 12, color: '#484f58', marginTop: 4 }}>{spec.modulePath}</div>
            </div>

            {/* Pipeline with trace highlighting */}
            {spec.steps && (
                <Section title="Pipeline">
                    <PipelineDiagram
                        steps={spec.steps}
                        tracedSteps={tracedSteps}
                        tracedFailure={tracedFailure}
                    />
                </Section>
            )}

            {/* Failures */}
            <Section title={`Failures (${failEntries.length})`}>
                {failEntries.length === 0 ? (
                    <div style={{ color: '#484f58', fontSize: 13 }}>No failure groups declared</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {failEntries.map(([key, group]) => {
                            const isTraced = tracedFailure === key
                            const canTrace = !!group.coveredBy
                            return (
                                <div
                                    key={key}
                                    style={{
                                        ...cardStyle,
                                        borderColor: isTraced ? '#58a6ff' : '#21262d',
                                        background: isTraced ? '#0d1f3c' : '#161b22',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <code style={codeStyle}>{key}</code>
                                        {group.coveredBy && (
                                            <button
                                                onClick={() => setTracedFailure(isTraced ? null : key)}
                                                style={{
                                                    background: isTraced ? '#1a3a5a' : 'transparent',
                                                    border: `1px solid ${isTraced ? '#58a6ff' : '#30363d'}`,
                                                    color: isTraced ? '#58a6ff' : '#8b949e',
                                                    padding: '1px 8px', borderRadius: 10,
                                                    cursor: 'pointer', fontSize: 10,
                                                }}
                                            >
                                                {isTraced ? 'hide trace' : 'trace'}
                                            </button>
                                        )}
                                        {group.coveredBy && (
                                            <span style={{ fontSize: 11, color: '#d2a8ff', fontFamily: 'monospace' }}>
                                                ← {group.coveredBy}
                                            </span>
                                        )}
                                        <ExampleBadge count={group.exampleCount} />
                                    </div>
                                    <div style={{ fontSize: 12, color: '#8b949e', marginTop: 4 }}>
                                        {group.description}
                                    </div>
                                    {/* Trace detail */}
                                    {isTraced && group.coveredBy && (
                                        <div style={{
                                            marginTop: 8, padding: '8px 12px',
                                            background: '#0d1117', borderRadius: 4,
                                            border: '1px solid #1a3a5a',
                                        }}>
                                            <div style={{ fontSize: 11, color: '#58a6ff', marginBottom: 6, fontWeight: 600 }}>
                                                Inheritance trace
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                {group.coveredBy.split(' → ').map((step, i, arr) => (
                                                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span style={{
                                                            fontSize: 11, fontFamily: 'monospace',
                                                            padding: '2px 8px', borderRadius: 4,
                                                            background: '#1a3a5a', color: '#79c0ff',
                                                        }}>
                                                            {step.trim()}
                                                        </span>
                                                        {i < arr.length - 1 && (
                                                            <span style={{ color: '#484f58', fontSize: 12 }}>→</span>
                                                        )}
                                                    </span>
                                                ))}
                                                <span style={{ color: '#484f58', fontSize: 12 }}>→</span>
                                                <span style={{
                                                    fontSize: 11, fontFamily: 'monospace',
                                                    padding: '2px 8px', borderRadius: 4,
                                                    background: '#3d1f1f', color: '#f85149',
                                                }}>
                                                    {key}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    {group.examples.length > 0 && (
                                        <ul style={{ margin: '6px 0 0 16px', fontSize: 12, color: '#c9d1d9' }}>
                                            {group.examples.map((e, i) => (
                                                <li key={i}>{e.description}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </Section>

            {/* Successes */}
            <Section title={`Success Types (${successEntries.length})`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {successEntries.map(([key, group]) => {
                        const assertions = spec.shouldAssert[key] || {}
                        const assertCount = Object.keys(assertions).length
                        return (
                            <div key={key} style={cardStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <code style={{ ...codeStyle, color: '#7ee787' }}>{key}</code>
                                    <ExampleBadge count={group.exampleCount} />
                                    <span style={{
                                        fontSize: 10,
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        background: assertCount > 0 ? '#1a3a2a' : '#3d1f1f',
                                        color: assertCount > 0 ? '#7ee787' : '#f85149',
                                    }}>
                                        {assertCount} assertion{assertCount !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <div style={{ fontSize: 12, color: '#8b949e', marginTop: 4 }}>
                                    {group.description}
                                </div>
                                {group.examples.length > 0 && (
                                    <ul style={{ margin: '6px 0 0 16px', fontSize: 12, color: '#c9d1d9' }}>
                                        {group.examples.map((e, i) => (
                                            <li key={i}>{e.description}</li>
                                        ))}
                                    </ul>
                                )}
                                {assertCount > 0 && (
                                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #21262d' }}>
                                        <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>Assertions:</div>
                                        {Object.entries(assertions).map(([name, a]) => (
                                            <div key={name} style={{ fontSize: 12, marginLeft: 8, color: '#c9d1d9' }}>
                                                <code style={{ fontSize: 11, color: '#d2a8ff' }}>{name}</code>
                                                <span style={{ color: '#484f58' }}> — </span>
                                                {a.description}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </Section>
        </div>
    )
}

// --- Pipeline diagram with trace highlighting ---

const STEP_COLORS: Record<string, string> = {
    step: '#58a6ff',
    'safe-dep': '#7ee787',
    dep: '#ffa657',
    strategy: '#d2a8ff',
}

function PipelineDiagram({ steps, tracedSteps, tracedFailure }: {
    steps: Array<{ name: string; type: string; description: string; handlers?: string[] }>
    tracedSteps: Set<string>
    tracedFailure: string | null
}) {
    const stepW = 150
    const stepH = 44
    const gapX = 60
    const startX = 50
    const railY = 50
    const failExitY = 130
    const totalW = startX + steps.length * (stepW + gapX) + 80
    const totalH = failExitY + 40

    return (
        <div style={{ overflowX: 'auto', marginBottom: 8 }}>
            <svg width={totalW} height={totalH} style={{ display: 'block' }}>
                {/* Entry */}
                <circle cx={20} cy={railY + stepH / 2} r={5} fill="#30363d" />
                <line x1={25} y1={railY + stepH / 2} x2={startX} y2={railY + stepH / 2} stroke="#30363d" strokeWidth={2} />

                {steps.map((step, i) => {
                    const x = startX + i * (stepW + gapX)
                    const cx = x + stepW / 2
                    const nextX = startX + (i + 1) * (stepW + gapX)
                    const color = STEP_COLORS[step.type] || '#484f58'
                    const isHighlighted = tracedSteps.has(step.name)
                    const glowColor = isHighlighted ? '#58a6ff' : undefined

                    return (
                        <g key={i}>
                            {/* Connector */}
                            {i < steps.length - 1 && (
                                <>
                                    <line
                                        x1={x + stepW} y1={railY + stepH / 2}
                                        x2={nextX} y2={railY + stepH / 2}
                                        stroke={isHighlighted ? '#58a6ff' : '#30363d'} strokeWidth={2}
                                    />
                                    <polygon
                                        points={`${nextX - 5},${railY + stepH / 2 - 3} ${nextX},${railY + stepH / 2} ${nextX - 5},${railY + stepH / 2 + 3}`}
                                        fill={isHighlighted ? '#58a6ff' : '#30363d'}
                                    />
                                </>
                            )}

                            {/* Glow filter for highlighted steps */}
                            {isHighlighted && (
                                <rect
                                    x={x - 2} y={railY - 2}
                                    width={stepW + 4} height={stepH + 4}
                                    rx={8} ry={8}
                                    fill="none" stroke="#58a6ff" strokeWidth={1}
                                    opacity={0.4}
                                />
                            )}

                            {/* Step box */}
                            <rect
                                x={x} y={railY}
                                width={stepW} height={stepH}
                                rx={6} ry={6}
                                fill={isHighlighted ? '#0d1f3c' : '#161b22'}
                                stroke={glowColor || color} strokeWidth={isHighlighted ? 2 : 1.5}
                            />

                            {/* Type badge */}
                            <rect
                                x={x + 4} y={railY + 4}
                                width={step.type.length * 6 + 8} height={13}
                                rx={3} ry={3}
                                fill={color + '33'}
                            />
                            <text
                                x={x + 8} y={railY + 13}
                                fontSize={8} fontWeight={600} fill={color}
                                fontFamily="monospace"
                            >
                                {step.type.toUpperCase()}
                            </text>

                            {/* Step name */}
                            <text
                                x={cx} y={railY + 32}
                                textAnchor="middle" fontSize={10}
                                fill={isHighlighted ? '#79c0ff' : '#c9d1d9'}
                                fontFamily="monospace" fontWeight={isHighlighted ? 700 : 500}
                            >
                                {step.name}
                            </text>

                            {/* Failure exit */}
                            <line
                                x1={cx} y1={railY + stepH}
                                x2={cx} y2={failExitY}
                                stroke={isHighlighted ? '#f8514999' : '#f8514944'}
                                strokeWidth={1} strokeDasharray="4 3"
                            />
                            {isHighlighted && tracedFailure && (
                                <text
                                    x={cx} y={failExitY + 12}
                                    textAnchor="middle" fontSize={8} fill="#f85149"
                                    fontFamily="monospace" fontWeight={600}
                                >
                                    {tracedFailure}
                                </text>
                            )}

                            {/* Step number */}
                            <text x={cx} y={railY - 6} textAnchor="middle" fontSize={9} fill="#484f58">{i + 1}</text>
                        </g>
                    )
                })}

                {/* Success terminal */}
                {(() => {
                    const endX = startX + (steps.length - 1) * (stepW + gapX) + stepW
                    return (
                        <>
                            <line
                                x1={endX} y1={railY + stepH / 2}
                                x2={endX + 30} y2={railY + stepH / 2}
                                stroke="#30363d" strokeWidth={2}
                            />
                            <circle
                                cx={endX + 44} cy={railY + stepH / 2}
                                r={10} fill="#1a3a2a" stroke="#7ee787" strokeWidth={1.5}
                            />
                            <text
                                x={endX + 44} y={railY + stepH / 2 + 4}
                                textAnchor="middle" fontSize={13} fill="#7ee787"
                            >
                                ✓
                            </text>
                        </>
                    )
                })()}
            </svg>
        </div>
    )
}

// --- Shared UI components ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#c9d1d9', marginBottom: 10, borderBottom: '1px solid #21262d', paddingBottom: 6 }}>
                {title}
            </h3>
            {children}
        </div>
    )
}

function StepBadge({ type }: { type: string }) {
    const colors: Record<string, { bg: string; fg: string }> = {
        step: { bg: '#1a3a4a', fg: '#58a6ff' },
        'safe-dep': { bg: '#1a3a2a', fg: '#7ee787' },
        dep: { bg: '#2d2a1a', fg: '#ffa657' },
        strategy: { bg: '#2a1a3a', fg: '#d2a8ff' },
    }
    const c = colors[type] || { bg: '#21262d', fg: '#8b949e' }
    return (
        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: c.bg, color: c.fg, fontFamily: 'monospace', fontWeight: 600 }}>
            {type.toUpperCase()}
        </span>
    )
}

function ExampleBadge({ count }: { count: number }) {
    return (
        <span style={{
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 4,
            background: count > 0 ? '#1a3a2a' : '#3d1f1f',
            color: count > 0 ? '#7ee787' : '#f85149',
        }}>
            {count} example{count !== 1 ? 's' : ''}
        </span>
    )
}

const backBtnStyle: React.CSSProperties = {
    background: 'transparent', border: '1px solid #30363d', color: '#8b949e',
    padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
}

const cardStyle: React.CSSProperties = {
    padding: '10px 14px', background: '#161b22', borderRadius: 6,
    border: '1px solid #21262d',
}

const codeStyle: React.CSSProperties = {
    fontSize: 12, fontFamily: 'monospace', color: '#f85149',
}
