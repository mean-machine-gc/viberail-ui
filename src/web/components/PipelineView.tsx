import { useEffect, useState } from 'react'
import { useSpecRevision } from '../hooks/useSpecRevision'

type SerializedSpec = {
    exportName: string
    modulePath: string
    steps?: Array<{ name: string; type: string; description: string; handlers?: string[] }>
    shouldFailWith: Record<string, { description: string; exampleCount: number; coveredBy?: string }>
    shouldSucceedWith: Record<string, { description: string; exampleCount: number }>
}

type SpecsData = { specs: SerializedSpec[]; count: number }

export function PipelineView({ onSelectSpec }: { onSelectSpec: (name: string) => void }) {
    const [specs, setSpecs] = useState<SerializedSpec[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null)
    const revision = useSpecRevision()

    useEffect(() => {
        fetch('/api/specs')
            .then(r => r.json())
            .then((d: SpecsData) => { setSpecs(d.specs); setLoading(false) })
            .catch(() => setLoading(false))
    }, [revision])

    if (loading) return <div style={{ padding: 32, color: '#8b949e' }}>Loading pipelines...</div>

    const pipelineSpecs = specs.filter(s => s.steps && s.steps.length > 0)
    const selected = selectedPipeline ? specs.find(s => s.exportName === selectedPipeline) : null

    return (
        <div style={{ padding: 24 }}>
            {/* Header */}
            <div style={{
                display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20,
                padding: '12px 16px', background: '#161b22', borderRadius: 8,
                border: '1px solid #30363d',
            }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#f0f6fc' }}>Pipelines</span>
                <span style={{ fontSize: 13, color: '#8b949e' }}>
                    {pipelineSpecs.length} specs with steps
                </span>
            </div>

            {!selected ? (
                /* Pipeline list */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {pipelineSpecs.map(spec => (
                        <button
                            key={spec.exportName}
                            onClick={() => setSelectedPipeline(spec.exportName)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '10px 14px', background: '#161b22', borderRadius: 6,
                                border: '1px solid #21262d', cursor: 'pointer',
                                textAlign: 'left', width: '100%',
                            }}
                            onMouseOver={e => (e.currentTarget.style.borderColor = '#30363d')}
                            onMouseOut={e => (e.currentTarget.style.borderColor = '#21262d')}
                        >
                            <code style={{ fontSize: 13, color: '#58a6ff', fontFamily: 'monospace' }}>
                                {spec.exportName}
                            </code>
                            <span style={{ fontSize: 12, color: '#484f58' }}>
                                {spec.steps!.length} steps
                            </span>
                            {/* Mini step preview */}
                            <div style={{ display: 'flex', gap: 3, marginLeft: 'auto' }}>
                                {spec.steps!.map((step, i) => (
                                    <span key={i} style={{
                                        width: 8, height: 8, borderRadius: 2,
                                        background: STEP_COLORS[step.type] || '#484f58',
                                    }} />
                                ))}
                            </div>
                        </button>
                    ))}
                </div>
            ) : (
                /* Pipeline detail — railroad diagram */
                <div>
                    <button
                        onClick={() => setSelectedPipeline(null)}
                        style={backBtnStyle}
                    >
                        &larr; Back to list
                    </button>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f0f6fc', marginTop: 12, marginBottom: 4 }}>
                        {selected.exportName}
                    </h3>
                    <div style={{ fontSize: 12, color: '#484f58', marginBottom: 20 }}>{selected.modulePath}</div>

                    <RailroadDiagram spec={selected} onSelectSpec={onSelectSpec} />
                </div>
            )}
        </div>
    )
}

const STEP_COLORS: Record<string, string> = {
    step: '#58a6ff',
    'safe-dep': '#7ee787',
    dep: '#ffa657',
    strategy: '#d2a8ff',
}

function RailroadDiagram({ spec, onSelectSpec }: { spec: SerializedSpec; onSelectSpec: (name: string) => void }) {
    if (!spec.steps) return null

    const steps = spec.steps
    const failKeys = Object.keys(spec.shouldFailWith)
    const successKeys = Object.keys(spec.shouldSucceedWith)

    // Layout constants
    const stepW = 160
    const stepH = 48
    const gapX = 80
    const startX = 60
    const railY = 80
    const failExitY = 180
    const totalW = startX + steps.length * (stepW + gapX) + 100
    const totalH = failExitY + 60

    return (
        <div style={{ overflowX: 'auto' }}>
            <svg width={totalW} height={totalH} style={{ display: 'block' }}>
                {/* Main rail */}
                <line
                    x1={20} y1={railY + stepH / 2}
                    x2={startX} y2={railY + stepH / 2}
                    stroke="#30363d" strokeWidth={2}
                />

                {steps.map((step, i) => {
                    const x = startX + i * (stepW + gapX)
                    const cx = x + stepW / 2
                    const nextX = startX + (i + 1) * (stepW + gapX)
                    const color = STEP_COLORS[step.type] || '#484f58'

                    return (
                        <g key={i}>
                            {/* Connector to next step */}
                            {i < steps.length - 1 && (
                                <>
                                    <line
                                        x1={x + stepW} y1={railY + stepH / 2}
                                        x2={nextX} y2={railY + stepH / 2}
                                        stroke="#30363d" strokeWidth={2}
                                    />
                                    {/* Arrow */}
                                    <polygon
                                        points={`${nextX - 6},${railY + stepH / 2 - 4} ${nextX},${railY + stepH / 2} ${nextX - 6},${railY + stepH / 2 + 4}`}
                                        fill="#30363d"
                                    />
                                </>
                            )}

                            {/* Step box */}
                            <rect
                                x={x} y={railY}
                                width={stepW} height={stepH}
                                rx={6} ry={6}
                                fill="#161b22"
                                stroke={color} strokeWidth={1.5}
                            />

                            {/* Step type badge */}
                            <rect
                                x={x + 4} y={railY + 4}
                                width={step.type.length * 6.5 + 8} height={14}
                                rx={3} ry={3}
                                fill={color + '33'}
                            />
                            <text
                                x={x + 8} y={railY + 14}
                                fontSize={8} fontWeight={600} fill={color}
                                fontFamily="monospace"
                            >
                                {step.type.toUpperCase()}
                            </text>

                            {/* Step name */}
                            <text
                                x={cx} y={railY + 32}
                                textAnchor="middle" fontSize={11} fill="#c9d1d9"
                                fontFamily="monospace" fontWeight={500}
                            >
                                {step.name}
                            </text>

                            {/* Failure exit — downward line */}
                            <line
                                x1={cx} y1={railY + stepH}
                                x2={cx} y2={failExitY}
                                stroke="#f8514966" strokeWidth={1} strokeDasharray="4 3"
                            />
                            <text
                                x={cx} y={failExitY + 14}
                                textAnchor="middle" fontSize={9} fill="#f85149"
                                fontFamily="monospace" opacity={0.7}
                            >
                                fail
                            </text>

                            {/* Step number */}
                            <text
                                x={cx} y={railY - 8}
                                textAnchor="middle" fontSize={9} fill="#484f58"
                            >
                                {i + 1}
                            </text>
                        </g>
                    )
                })}

                {/* Success end */}
                {(() => {
                    const endX = startX + steps.length * (stepW + gapX)
                    return (
                        <>
                            <line
                                x1={startX + (steps.length - 1) * (stepW + gapX) + stepW}
                                y1={railY + stepH / 2}
                                x2={endX} y2={railY + stepH / 2}
                                stroke="#30363d" strokeWidth={2}
                            />
                            <circle
                                cx={endX + 16} cy={railY + stepH / 2}
                                r={12} fill="#1a3a2a" stroke="#7ee787" strokeWidth={1.5}
                            />
                            <text
                                x={endX + 16} y={railY + stepH / 2 + 4}
                                textAnchor="middle" fontSize={14} fill="#7ee787"
                            >
                                ✓
                            </text>
                            {successKeys.map((key, i) => (
                                <text
                                    key={key}
                                    x={endX + 36} y={railY + stepH / 2 - 4 + i * 14}
                                    fontSize={10} fill="#7ee787" fontFamily="monospace"
                                >
                                    {key}
                                </text>
                            ))}
                        </>
                    )
                })()}

                {/* Entry circle */}
                <circle cx={20} cy={railY + stepH / 2} r={6} fill="#30363d" />
            </svg>
        </div>
    )
}

const backBtnStyle: React.CSSProperties = {
    background: 'transparent', border: '1px solid #30363d', color: '#8b949e',
    padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
}
