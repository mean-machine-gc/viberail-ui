import { useEffect, useState } from 'react'
import { useSpecRevision } from '../hooks/useSpecRevision'
import { Paper, Group, Button, Text, Code, Loader, Title, UnstyledButton, Stack } from '@mantine/core'
import { ArrowLeft } from '@phosphor-icons/react'
import { useDiagramColors } from '../hooks/useDiagramColors'

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
    const { stepColors } = useDiagramColors()

    useEffect(() => {
        fetch('/api/specs')
            .then(r => r.json())
            .then((d: SpecsData) => { setSpecs(d.specs); setLoading(false) })
            .catch(() => setLoading(false))
    }, [revision])

    if (loading) return <Group p="xl"><Loader size="sm" /><Text c="dimmed">Loading pipelines...</Text></Group>

    const pipelineSpecs = specs.filter(s => s.steps && s.steps.length > 0)
    const selected = selectedPipeline ? specs.find(s => s.exportName === selectedPipeline) : null

    return (
        <div style={{ padding: 24 }}>
            <Paper p="sm" radius="md" withBorder mb="lg">
                <Group>
                    <Title order={4}>Pipelines</Title>
                    <Text size="sm" c="dimmed">{pipelineSpecs.length} specs with steps</Text>
                </Group>
            </Paper>

            {!selected ? (
                <Stack gap="xs">
                    {pipelineSpecs.map(spec => (
                        <UnstyledButton
                            key={spec.exportName}
                            onClick={() => setSelectedPipeline(spec.exportName)}
                            w="100%"
                        >
                            <Paper p="sm" radius="sm" withBorder style={{ cursor: 'pointer' }}>
                                <Group>
                                    <Code fz="sm">{spec.exportName}</Code>
                                    <Text size="xs" c="dimmed">{spec.steps!.length} steps</Text>
                                    <Group gap={3} ml="auto">
                                        {spec.steps!.map((step, i) => (
                                            <span key={i} style={{
                                                width: 8, height: 8, borderRadius: 2,
                                                background: stepColors[step.type] || 'var(--mantine-color-gray-6)',
                                            }} />
                                        ))}
                                    </Group>
                                </Group>
                            </Paper>
                        </UnstyledButton>
                    ))}
                </Stack>
            ) : (
                <div>
                    <Button
                        variant="subtle"
                        size="xs"
                        leftSection={<ArrowLeft size={14} />}
                        onClick={() => setSelectedPipeline(null)}
                    >
                        Back to list
                    </Button>
                    <Title order={4} mt="sm" mb={4}>{selected.exportName}</Title>
                    <Text size="xs" c="dimmed" mb="lg">{selected.modulePath}</Text>
                    <RailroadDiagram spec={selected} stepColors={stepColors} />
                </div>
            )}
        </div>
    )
}

function RailroadDiagram({ spec, stepColors }: { spec: SerializedSpec; stepColors: Record<string, string> }) {
    const { borderColor, surfaceColor, textColor, mutedColor, failColor, successColor, successBg } = useDiagramColors()
    if (!spec.steps) return null

    const steps = spec.steps
    const successKeys = Object.keys(spec.shouldSucceedWith)

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
                <line x1={20} y1={railY + stepH / 2} x2={startX} y2={railY + stepH / 2} stroke={borderColor} strokeWidth={2} />

                {steps.map((step, i) => {
                    const x = startX + i * (stepW + gapX)
                    const cx = x + stepW / 2
                    const nextX = startX + (i + 1) * (stepW + gapX)
                    const color = stepColors[step.type] || mutedColor

                    return (
                        <g key={i}>
                            {i < steps.length - 1 && (
                                <>
                                    <line x1={x + stepW} y1={railY + stepH / 2} x2={nextX} y2={railY + stepH / 2} stroke={borderColor} strokeWidth={2} />
                                    <polygon
                                        points={`${nextX - 6},${railY + stepH / 2 - 4} ${nextX},${railY + stepH / 2} ${nextX - 6},${railY + stepH / 2 + 4}`}
                                        fill={borderColor}
                                    />
                                </>
                            )}
                            <rect x={x} y={railY} width={stepW} height={stepH} rx={6} ry={6} fill={surfaceColor} stroke={color} strokeWidth={1.5} />
                            <rect x={x + 4} y={railY + 4} width={step.type.length * 6.5 + 8} height={14} rx={3} ry={3} fill={color + '33'} />
                            <text x={x + 8} y={railY + 14} fontSize={8} fontWeight={600} fill={color} fontFamily="monospace">{step.type.toUpperCase()}</text>
                            <text x={cx} y={railY + 32} textAnchor="middle" fontSize={11} fill={textColor} fontFamily="monospace" fontWeight={500}>{step.name}</text>
                            <line x1={cx} y1={railY + stepH} x2={cx} y2={failExitY} stroke={failColor + '66'} strokeWidth={1} strokeDasharray="4 3" />
                            <text x={cx} y={failExitY + 14} textAnchor="middle" fontSize={9} fill={failColor} fontFamily="monospace" opacity={0.7}>fail</text>
                            <text x={cx} y={railY - 8} textAnchor="middle" fontSize={9} fill={mutedColor}>{i + 1}</text>
                        </g>
                    )
                })}

                {(() => {
                    const endX = startX + steps.length * (stepW + gapX)
                    return (
                        <>
                            <line x1={startX + (steps.length - 1) * (stepW + gapX) + stepW} y1={railY + stepH / 2} x2={endX} y2={railY + stepH / 2} stroke={borderColor} strokeWidth={2} />
                            <circle cx={endX + 16} cy={railY + stepH / 2} r={12} fill={successBg} stroke={successColor} strokeWidth={1.5} />
                            <text x={endX + 16} y={railY + stepH / 2 + 4} textAnchor="middle" fontSize={14} fill={successColor}>&#x2713;</text>
                            {successKeys.map((key, i) => (
                                <text key={key} x={endX + 36} y={railY + stepH / 2 - 4 + i * 14} fontSize={10} fill={successColor} fontFamily="monospace">{key}</text>
                            ))}
                        </>
                    )
                })()}

                <circle cx={20} cy={railY + stepH / 2} r={6} fill={borderColor} />
            </svg>
        </div>
    )
}
