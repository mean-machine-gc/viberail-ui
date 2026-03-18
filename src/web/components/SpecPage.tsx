import { useEffect, useState } from 'react'
import { DecisionTable } from './DecisionTable'

type ExampleWithData = { description: string; whenInput?: unknown; then?: unknown }

type SerializedSpec = {
    exportName: string
    filePath: string
    modulePath: string
    document?: boolean
    steps?: Array<{ name: string; type: string; description: string; handlers?: string[] }>
    shouldFailWith: Record<string, { description: string; exampleCount: number; examples: ExampleWithData[]; coveredBy?: string }>
    shouldSucceedWith: Record<string, { description: string; exampleCount: number; examples: ExampleWithData[] }>
    shouldAssert: Record<string, Record<string, { description: string }>>
}

function humanize(exportName: string): string {
    // createDispatchSpec → Create Dispatch
    const name = exportName.replace(/Spec$/, '')
    return name
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, s => s.toUpperCase())
}

const STEP_COLORS: Record<string, string> = {
    step: '#58a6ff',
    'safe-dep': '#7ee787',
    dep: '#ffa657',
    strategy: '#d2a8ff',
}

export function SpecPage({ specName, onBack }: { specName: string; onBack: () => void }) {
    const [spec, setSpec] = useState<SerializedSpec | null>(null)
    const [loading, setLoading] = useState(true)
    const [tracedFailure, setTracedFailure] = useState<string | null>(null)

    useEffect(() => {
        setLoading(true)
        setTracedFailure(null)
        fetch(`/api/spec/${specName}`)
            .then(r => r.json())
            .then(s => { setSpec(s); setLoading(false) })
            .catch(() => setLoading(false))
    }, [specName])

    if (loading) return <div style={{ padding: 48, color: '#8b949e' }}>Loading...</div>
    if (!spec) return <div style={{ padding: 48, color: '#f85149' }}>Spec not found</div>

    const failEntries = Object.entries(spec.shouldFailWith)
    const successEntries = Object.entries(spec.shouldSucceedWith)
    const totalExamples = failEntries.reduce((n, [, g]) => n + g.exampleCount, 0)
        + successEntries.reduce((n, [, g]) => n + g.exampleCount, 0)
    const totalAssertions = Object.values(spec.shouldAssert).reduce((n, a) => n + Object.keys(a).length, 0)
    const isPipeline = !!spec.steps && spec.steps.length > 0

    // Trace logic
    const tracedSteps = new Set<string>()
    if (tracedFailure && spec.shouldFailWith[tracedFailure]?.coveredBy) {
        for (const part of spec.shouldFailWith[tracedFailure].coveredBy!.split(' → ')) {
            tracedSteps.add(part.trim())
        }
    }

    return (
        <div style={{ padding: '32px 48px', maxWidth: 840, margin: '0 auto' }}>
            {/* Back */}
            <button onClick={onBack} style={backBtnStyle}>&larr; Back</button>

            {/* Header */}
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#f0f6fc', marginTop: 12, marginBottom: 4, lineHeight: 1.2 }}>
                {humanize(spec.exportName)}
            </h1>
            <div style={{ fontSize: 13, color: '#484f58', fontFamily: 'monospace', marginBottom: 12 }}>
                {spec.modulePath}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                <Badge bg="#1a3a4a" fg="#58a6ff">
                    {isPipeline ? `Pipeline (${spec.steps!.length} steps)` : 'Atomic'}
                </Badge>
                <Badge bg="#3d1f1f" fg="#f85149">{failEntries.length} failure{failEntries.length !== 1 ? 's' : ''}</Badge>
                <Badge bg="#1a3a2a" fg="#7ee787">{successEntries.length} success type{successEntries.length !== 1 ? 's' : ''}</Badge>
                <Badge bg="#2a1a3a" fg="#d2a8ff">{totalAssertions} assertion{totalAssertions !== 1 ? 's' : ''}</Badge>
                <Badge bg="#21262d" fg="#8b949e">{totalExamples} example{totalExamples !== 1 ? 's' : ''}</Badge>
            </div>

            {/* Overview */}
            <p style={{ fontSize: 14, color: '#8b949e', marginBottom: 24, lineHeight: 1.6 }}>
                {isPipeline
                    ? <>Executes {spec.steps!.length} steps: {spec.steps!.map((s, i) => (
                        <span key={i}>
                            {i > 0 && <span style={{ color: '#484f58' }}> → </span>}
                            <code style={{ color: '#79c0ff', fontSize: 13 }}>{s.name}</code>
                        </span>
                    ))}. </>
                    : null}
                Can fail with {failEntries.length} failure type{failEntries.length !== 1 ? 's' : ''} and
                succeed with {successEntries.length} success type{successEntries.length !== 1 ? 's' : ''}.
            </p>

            {/* Pipeline diagram */}
            {isPipeline && (
                <Section title="Pipeline">
                    <PipelineDiagram
                        steps={spec.steps!}
                        tracedSteps={tracedSteps}
                        tracedFailure={tracedFailure}
                    />
                </Section>
            )}

            {/* Decision Table */}
            <Section title="Decision Table">
                <DecisionTable
                    steps={spec.steps}
                    shouldFailWith={spec.shouldFailWith}
                    shouldSucceedWith={spec.shouldSucceedWith}
                />
            </Section>

            {/* Failures */}
            <Section title={`Failures (${failEntries.length})`}>
                {failEntries.length === 0 ? (
                    <div style={{ color: '#484f58', fontSize: 13 }}>No failure groups declared</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {failEntries.map(([key, group]) => {
                            const isTraced = tracedFailure === key
                            return (
                                <div key={key} style={{
                                    ...cardStyle,
                                    borderColor: isTraced ? '#58a6ff' : '#21262d',
                                    background: isTraced ? '#0d1f3c' : '#161b22',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <code style={{ fontSize: 14, fontFamily: 'monospace', color: '#f85149', fontWeight: 600 }}>{key}</code>
                                        {group.coveredBy && (
                                            <button
                                                onClick={() => setTracedFailure(isTraced ? null : key)}
                                                style={{
                                                    background: isTraced ? '#1a3a5a' : 'transparent',
                                                    border: `1px solid ${isTraced ? '#58a6ff' : '#30363d'}`,
                                                    color: isTraced ? '#58a6ff' : '#8b949e',
                                                    padding: '2px 10px', borderRadius: 10,
                                                    cursor: 'pointer', fontSize: 11,
                                                }}
                                            >
                                                {isTraced ? 'hide trace' : 'trace'}
                                            </button>
                                        )}
                                        <span style={{ fontSize: 11, color: '#8b949e' }}>
                                            {group.exampleCount} example{group.exampleCount !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <p style={{ fontSize: 13, color: '#c9d1d9', marginTop: 6, lineHeight: 1.5, margin: '6px 0 0 0' }}>
                                        {group.description}
                                    </p>
                                    {group.coveredBy && (
                                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: 11, color: '#8b949e' }}>Inherited from:</span>
                                            {group.coveredBy.split(' → ').map((step, i, arr) => (
                                                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <code style={{
                                                        fontSize: 11, padding: '2px 8px', borderRadius: 4,
                                                        background: '#1a3a5a', color: '#79c0ff',
                                                    }}>{step.trim()}</code>
                                                    {i < arr.length - 1 && <span style={{ color: '#484f58' }}>→</span>}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {/* Trace detail in pipeline */}
                                    {isTraced && group.coveredBy && (
                                        <div style={{
                                            marginTop: 10, padding: '8px 12px',
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
                                                        }}>{step.trim()}</span>
                                                        {i < arr.length - 1 && <span style={{ color: '#484f58', fontSize: 12 }}>→</span>}
                                                    </span>
                                                ))}
                                                <span style={{ color: '#484f58', fontSize: 12 }}>→</span>
                                                <span style={{
                                                    fontSize: 11, fontFamily: 'monospace',
                                                    padding: '2px 8px', borderRadius: 4,
                                                    background: '#3d1f1f', color: '#f85149',
                                                }}>{key}</span>
                                            </div>
                                        </div>
                                    )}
                                    {group.examples.length > 0 && (
                                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {group.examples.map((e, i) => (
                                                <ExampleCard key={i} example={e} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </Section>

            {/* Successes */}
            <Section title={`Success Types (${successEntries.length})`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {successEntries.map(([key, group]) => {
                        const assertions = spec.shouldAssert[key] || {}
                        const assertEntries = Object.entries(assertions)
                        return (
                            <div key={key} style={cardStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <code style={{ fontSize: 14, fontFamily: 'monospace', color: '#7ee787', fontWeight: 600 }}>{key}</code>
                                    <span style={{ fontSize: 11, color: '#8b949e' }}>
                                        {group.exampleCount} example{group.exampleCount !== 1 ? 's' : ''}
                                    </span>
                                    <Badge
                                        bg={assertEntries.length > 0 ? '#1a3a2a' : '#3d1f1f'}
                                        fg={assertEntries.length > 0 ? '#7ee787' : '#f85149'}
                                    >
                                        {assertEntries.length} assertion{assertEntries.length !== 1 ? 's' : ''}
                                    </Badge>
                                </div>
                                <p style={{ fontSize: 13, color: '#c9d1d9', marginTop: 6, lineHeight: 1.5, margin: '6px 0 0 0' }}>
                                    {group.description}
                                </p>
                                {group.examples.length > 0 && (
                                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {group.examples.map((e, i) => (
                                            <ExampleCard key={i} example={e} showOutput />
                                        ))}
                                    </div>
                                )}
                                {assertEntries.length > 0 && (
                                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #21262d' }}>
                                        <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 6, fontWeight: 600 }}>Assertions</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            {assertEntries.map(([name, a]) => (
                                                <div key={name} style={{ fontSize: 13, color: '#c9d1d9', paddingLeft: 8 }}>
                                                    <code style={{ fontSize: 12, color: '#d2a8ff' }}>{name}</code>
                                                    <span style={{ color: '#484f58' }}> — </span>
                                                    {a.description}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </Section>

            {/* Assertions summary */}
            {totalAssertions > 0 && successEntries.length > 1 && (
                <Section title="Assertions Summary">
                    <AssertionMatrix
                        shouldSucceedWith={spec.shouldSucceedWith}
                        shouldAssert={spec.shouldAssert}
                    />
                </Section>
            )}
        </div>
    )
}

// --- Assertion cross-reference matrix ---

function AssertionMatrix({ shouldSucceedWith, shouldAssert }: {
    shouldSucceedWith: Record<string, { description: string }>
    shouldAssert: Record<string, Record<string, { description: string }>>
}) {
    const successTypes = Object.keys(shouldSucceedWith)
    const allAssertions = new Set<string>()
    for (const assertions of Object.values(shouldAssert)) {
        for (const name of Object.keys(assertions)) allAssertions.add(name)
    }
    const assertionNames = [...allAssertions].sort()

    if (assertionNames.length === 0) return null

    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
                <thead>
                    <tr>
                        <th style={matrixThStyle}></th>
                        {successTypes.map(t => (
                            <th key={t} style={{ ...matrixThStyle, textAlign: 'center', color: '#7ee787' }}>{t}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {assertionNames.map(name => (
                        <tr key={name}>
                            <td style={{ ...matrixTdStyle, color: '#d2a8ff' }}>{name}</td>
                            {successTypes.map(t => {
                                const has = !!(shouldAssert[t] && shouldAssert[t][name])
                                return (
                                    <td key={t} style={{ ...matrixTdStyle, textAlign: 'center' }}>
                                        {has
                                            ? <span style={{ color: '#7ee787' }}>●</span>
                                            : <span style={{ color: '#484f58' }}>—</span>}
                                    </td>
                                )
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

// --- Pipeline diagram (reused from SpecDetail with trace support) ---

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
    const [hoveredStep, setHoveredStep] = useState<number | null>(null)

    return (
        <div style={{ overflowX: 'auto', marginBottom: 8, position: 'relative' }}>
            <svg width={totalW} height={totalH} style={{ display: 'block' }}>
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
                        <g key={i}
                            onMouseEnter={() => setHoveredStep(i)}
                            onMouseLeave={() => setHoveredStep(null)}
                            style={{ cursor: 'default' }}
                        >
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
                            {isHighlighted && (
                                <rect
                                    x={x - 2} y={railY - 2}
                                    width={stepW + 4} height={stepH + 4}
                                    rx={8} ry={8}
                                    fill="none" stroke="#58a6ff" strokeWidth={1} opacity={0.4}
                                />
                            )}
                            <rect
                                x={x} y={railY}
                                width={stepW} height={stepH}
                                rx={6} ry={6}
                                fill={isHighlighted ? '#0d1f3c' : '#161b22'}
                                stroke={glowColor || color} strokeWidth={isHighlighted ? 2 : 1.5}
                            />
                            <rect
                                x={x + 4} y={railY + 4}
                                width={step.type.length * 6 + 8} height={13}
                                rx={3} ry={3}
                                fill={color + '33'}
                            />
                            <text
                                x={x + 8} y={railY + 13}
                                fontSize={8} fontWeight={600} fill={color} fontFamily="monospace"
                            >
                                {step.type.toUpperCase()}
                            </text>
                            <text
                                x={cx} y={railY + 32}
                                textAnchor="middle" fontSize={10}
                                fill={isHighlighted ? '#79c0ff' : '#c9d1d9'}
                                fontFamily="monospace" fontWeight={isHighlighted ? 700 : 500}
                            >
                                {step.name}
                            </text>
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
                            <text x={cx} y={railY - 6} textAnchor="middle" fontSize={9} fill="#484f58">{i + 1}</text>
                        </g>
                    )
                })}

                {/* Tooltip for hovered step */}
                {hoveredStep !== null && (() => {
                    const step = steps[hoveredStep]
                    const x = startX + hoveredStep * (stepW + gapX)
                    return (
                        <foreignObject x={x} y={railY + stepH + 4} width={200} height={40}>
                            <div style={{
                                background: '#21262d', border: '1px solid #30363d', borderRadius: 4,
                                padding: '4px 8px', fontSize: 11, color: '#c9d1d9',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                                {step.description}
                            </div>
                        </foreignObject>
                    )
                })()}

                {/* Success terminal */}
                {(() => {
                    const endX = startX + (steps.length - 1) * (stepW + gapX) + stepW
                    return (
                        <>
                            <line x1={endX} y1={railY + stepH / 2} x2={endX + 30} y2={railY + stepH / 2} stroke="#30363d" strokeWidth={2} />
                            <circle cx={endX + 44} cy={railY + stepH / 2} r={10} fill="#1a3a2a" stroke="#7ee787" strokeWidth={1.5} />
                            <text x={endX + 44} y={railY + stepH / 2 + 4} textAnchor="middle" fontSize={13} fill="#7ee787">✓</text>
                        </>
                    )
                })()}
            </svg>
        </div>
    )
}

// --- Example rendering ---

function ExampleCard({ example, showOutput }: { example: ExampleWithData; showOutput?: boolean }) {
    const hasInput = example.whenInput !== undefined
    const hasOutput = showOutput && example.then !== undefined

    if (!hasInput && !hasOutput) {
        return (
            <div style={{ fontSize: 13, color: '#c9d1d9', paddingLeft: 8, borderLeft: '2px solid #21262d', padding: '4px 0 4px 10px' }}>
                {example.description}
            </div>
        )
    }

    return (
        <div style={{
            background: '#0d1117', borderRadius: 6,
            border: '1px solid #21262d', overflow: 'hidden',
        }}>
            <div style={{ padding: '8px 12px', fontSize: 13, color: '#c9d1d9', borderBottom: '1px solid #21262d' }}>
                {example.description}
            </div>
            {hasInput && (
                <CollapsibleJson label="Input" data={example.whenInput} />
            )}
            {hasOutput && (
                <CollapsibleJson label="Output" data={example.then} />
            )}
        </div>
    )
}

function CollapsibleJson({ label, data }: { label: string; data: unknown }) {
    const [open, setOpen] = useState(false)

    return (
        <div style={{ borderTop: '1px solid #21262d' }}>
            <button
                onClick={() => setOpen(!open)}
                style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: '6px 12px', width: '100%', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 6,
                    color: '#8b949e', fontSize: 11, fontWeight: 600,
                }}
            >
                <span style={{
                    display: 'inline-block', fontSize: 9,
                    transition: 'transform 0.15s',
                    transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                }}>▶</span>
                {label}
            </button>
            {open && (
                <pre style={{
                    margin: 0, padding: '8px 12px',
                    background: '#0d1117', fontSize: 12,
                    fontFamily: 'monospace', lineHeight: 1.5,
                    overflowX: 'auto', whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                }}>
                    {syntaxHighlight(JSON.stringify(data, null, 2))}
                </pre>
            )}
        </div>
    )
}

function syntaxHighlight(json: string): React.ReactNode[] {
    const parts: React.ReactNode[] = []
    // Simple tokenizer for JSON syntax highlighting
    const regex = /("(?:\\.|[^"\\])*")\s*:/g
    let lastIndex = 0
    let match

    // First pass: highlight keys
    const keyPositions: Array<{ start: number; end: number }> = []
    while ((match = regex.exec(json)) !== null) {
        keyPositions.push({ start: match.index, end: match.index + match[1].length })
    }

    // Build highlighted output character by character using simple rules
    let i = 0
    let current = ''
    let currentColor = '#c9d1d9'

    const flush = () => {
        if (current) {
            parts.push(<span key={parts.length} style={{ color: currentColor }}>{current}</span>)
            current = ''
        }
    }

    while (i < json.length) {
        // Check if we're at a key position
        const keyPos = keyPositions.find(p => p.start === i)
        if (keyPos) {
            flush()
            parts.push(<span key={parts.length} style={{ color: '#79c0ff' }}>{json.slice(keyPos.start, keyPos.end)}</span>)
            i = keyPos.end
            currentColor = '#c9d1d9'
            continue
        }

        // String values (not keys)
        if (json[i] === '"') {
            flush()
            let j = i + 1
            while (j < json.length && (json[j] !== '"' || json[j - 1] === '\\')) j++
            j++ // include closing quote
            parts.push(<span key={parts.length} style={{ color: '#a5d6ff' }}>{json.slice(i, j)}</span>)
            i = j
            continue
        }

        // Numbers
        if (/[\d.]/.test(json[i]) && (i === 0 || /[^"\w]/.test(json[i - 1]))) {
            flush()
            let j = i
            while (j < json.length && /[\d.eE+-]/.test(json[j])) j++
            parts.push(<span key={parts.length} style={{ color: '#ffa657' }}>{json.slice(i, j)}</span>)
            i = j
            continue
        }

        // Booleans and null
        const remaining = json.slice(i)
        const boolMatch = remaining.match(/^(true|false|null)/)
        if (boolMatch && (i === 0 || /[^"\w]/.test(json[i - 1]))) {
            flush()
            parts.push(<span key={parts.length} style={{ color: '#ff7b72' }}>{boolMatch[1]}</span>)
            i += boolMatch[1].length
            continue
        }

        current += json[i]
        i++
    }
    flush()

    return parts
}

// --- Shared components ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 32 }}>
            <h2 style={{
                fontSize: 16, fontWeight: 600, color: '#c9d1d9',
                marginBottom: 12, paddingBottom: 8,
                borderBottom: '1px solid #21262d',
            }}>
                {title}
            </h2>
            {children}
        </div>
    )
}

function Badge({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
    return (
        <span style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 10,
            background: bg, color: fg, fontWeight: 600, whiteSpace: 'nowrap',
        }}>
            {children}
        </span>
    )
}

const backBtnStyle: React.CSSProperties = {
    background: 'transparent', border: '1px solid #30363d', color: '#8b949e',
    padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
}

const cardStyle: React.CSSProperties = {
    padding: '14px 18px', background: '#161b22', borderRadius: 8,
    border: '1px solid #21262d',
}

const matrixThStyle: React.CSSProperties = {
    padding: '6px 10px', borderBottom: '2px solid #30363d', color: '#8b949e', fontWeight: 600, fontSize: 11,
}

const matrixTdStyle: React.CSSProperties = {
    padding: '4px 10px', borderBottom: '1px solid #21262d',
}
