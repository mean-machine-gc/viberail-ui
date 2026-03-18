import { useEffect, useState } from 'react'
import { Paper, Group, Badge, Button, Text, Code, Stack, Loader, Title, Collapse, Divider } from '@mantine/core'
import { ArrowLeft } from '@phosphor-icons/react'
import { useDiagramColors } from '../hooks/useDiagramColors'

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

    if (loading) return <Group p="xl"><Loader size="sm" /><Text c="dimmed">Loading...</Text></Group>
    if (!spec) return <Text p="xl" c="red">Spec not found</Text>

    const failEntries = Object.entries(spec.shouldFailWith)
    const successEntries = Object.entries(spec.shouldSucceedWith)

    const tracedSteps = new Set<string>()
    if (tracedFailure && spec.shouldFailWith[tracedFailure]?.coveredBy) {
        for (const part of spec.shouldFailWith[tracedFailure].coveredBy!.split(' → ')) {
            tracedSteps.add(part.trim())
        }
    }

    return (
        <div style={{ padding: 24, maxWidth: 960 }}>
            <Button variant="subtle" size="xs" leftSection={<ArrowLeft size={14} />} onClick={onBack} mb="xs">
                Back to graph
            </Button>
            <Title order={3} mb={4}>{spec.exportName}</Title>
            <Text size="xs" c="dimmed" mb="lg">{spec.modulePath}</Text>

            {spec.steps && (
                <Section title="Pipeline">
                    <PipelineDiagram steps={spec.steps} tracedSteps={tracedSteps} tracedFailure={tracedFailure} />
                </Section>
            )}

            <Section title={`Failures (${failEntries.length})`}>
                {failEntries.length === 0 ? (
                    <Text size="sm" c="dimmed">No failure groups declared</Text>
                ) : (
                    <Stack gap="xs">
                        {failEntries.map(([key, group]) => {
                            const isTraced = tracedFailure === key
                            return (
                                <Paper key={key} p="sm" radius="sm" withBorder
                                    style={{
                                        borderColor: isTraced ? 'var(--mantine-color-blue-6)' : undefined,
                                        background: isTraced ? 'var(--mantine-color-blue-light)' : undefined,
                                    }}
                                >
                                    <Group gap="xs">
                                        <Code fz="xs" c="red">{key}</Code>
                                        {group.coveredBy && (
                                            <Button size="compact-xs" variant={isTraced ? 'light' : 'subtle'} radius="xl"
                                                onClick={() => setTracedFailure(isTraced ? null : key)}
                                            >
                                                {isTraced ? 'hide trace' : 'trace'}
                                            </Button>
                                        )}
                                        {group.coveredBy && (
                                            <Text size="xs" c="violet" ff="monospace">&larr; {group.coveredBy}</Text>
                                        )}
                                        <Badge size="xs" variant="light" color={group.exampleCount > 0 ? 'green' : 'red'}>
                                            {group.exampleCount} example{group.exampleCount !== 1 ? 's' : ''}
                                        </Badge>
                                    </Group>
                                    <Text size="xs" c="dimmed" mt={4}>{group.description}</Text>

                                    {isTraced && group.coveredBy && (
                                        <Paper p="xs" radius="sm" withBorder mt="xs" bg="var(--mantine-color-body)">
                                            <Text size="xs" c="blue" fw={600} mb="xs">Inheritance trace</Text>
                                            <Group gap="xs" wrap="wrap">
                                                {group.coveredBy.split(' → ').map((step, i, arr) => (
                                                    <Group key={i} gap="xs">
                                                        <Code fz="xs" c="blue">{step.trim()}</Code>
                                                        {i < arr.length - 1 && <Text c="dimmed" size="xs">&rarr;</Text>}
                                                    </Group>
                                                ))}
                                                <Text c="dimmed" size="xs">&rarr;</Text>
                                                <Code fz="xs" c="red">{key}</Code>
                                            </Group>
                                        </Paper>
                                    )}

                                    {group.examples.length > 0 && (
                                        <ul style={{ margin: '6px 0 0 16px', fontSize: 12 }}>
                                            {group.examples.map((e, i) => <li key={i}>{e.description}</li>)}
                                        </ul>
                                    )}
                                </Paper>
                            )
                        })}
                    </Stack>
                )}
            </Section>

            <Section title={`Success Types (${successEntries.length})`}>
                <Stack gap="xs">
                    {successEntries.map(([key, group]) => {
                        const assertions = spec.shouldAssert[key] || {}
                        const assertCount = Object.keys(assertions).length
                        return (
                            <Paper key={key} p="sm" radius="sm" withBorder>
                                <Group gap="xs">
                                    <Code fz="xs" c="green">{key}</Code>
                                    <Badge size="xs" variant="light" color={group.exampleCount > 0 ? 'green' : 'red'}>
                                        {group.exampleCount} example{group.exampleCount !== 1 ? 's' : ''}
                                    </Badge>
                                    <Badge size="xs" variant="light" color={assertCount > 0 ? 'green' : 'red'}>
                                        {assertCount} assertion{assertCount !== 1 ? 's' : ''}
                                    </Badge>
                                </Group>
                                <Text size="xs" c="dimmed" mt={4}>{group.description}</Text>
                                {group.examples.length > 0 && (
                                    <ul style={{ margin: '6px 0 0 16px', fontSize: 12 }}>
                                        {group.examples.map((e, i) => <li key={i}>{e.description}</li>)}
                                    </ul>
                                )}
                                {assertCount > 0 && (
                                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--mantine-color-default-border)' }}>
                                        <Text size="xs" c="dimmed" mb={4}>Assertions:</Text>
                                        {Object.entries(assertions).map(([name, a]) => (
                                            <Text key={name} size="xs" ml="xs">
                                                <Code fz="xs" c="violet">{name}</Code>
                                                <Text span c="dimmed"> &mdash; </Text>
                                                {a.description}
                                            </Text>
                                        ))}
                                    </div>
                                )}
                            </Paper>
                        )
                    })}
                </Stack>
            </Section>
        </div>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 24 }}>
            <Title order={5} mb="xs" pb="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                {title}
            </Title>
            {children}
        </div>
    )
}

function PipelineDiagram({ steps, tracedSteps, tracedFailure }: {
    steps: Array<{ name: string; type: string; description: string; handlers?: string[] }>
    tracedSteps: Set<string>
    tracedFailure: string | null
}) {
    const { borderColor, surfaceColor, textColor, mutedColor, highlightColor, highlightBg, highlightText, failColor, successColor, successBg, stepColors } = useDiagramColors()

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
                <circle cx={20} cy={railY + stepH / 2} r={5} fill={borderColor} />
                <line x1={25} y1={railY + stepH / 2} x2={startX} y2={railY + stepH / 2} stroke={borderColor} strokeWidth={2} />

                {steps.map((step, i) => {
                    const x = startX + i * (stepW + gapX)
                    const cx = x + stepW / 2
                    const nextX = startX + (i + 1) * (stepW + gapX)
                    const color = stepColors[step.type] || mutedColor
                    const isHighlighted = tracedSteps.has(step.name)

                    return (
                        <g key={i}>
                            {i < steps.length - 1 && (
                                <>
                                    <line x1={x + stepW} y1={railY + stepH / 2} x2={nextX} y2={railY + stepH / 2}
                                        stroke={isHighlighted ? highlightColor : borderColor} strokeWidth={2} />
                                    <polygon
                                        points={`${nextX - 5},${railY + stepH / 2 - 3} ${nextX},${railY + stepH / 2} ${nextX - 5},${railY + stepH / 2 + 3}`}
                                        fill={isHighlighted ? highlightColor : borderColor} />
                                </>
                            )}
                            {isHighlighted && (
                                <rect x={x - 2} y={railY - 2} width={stepW + 4} height={stepH + 4}
                                    rx={8} ry={8} fill="none" stroke={highlightColor} strokeWidth={1} opacity={0.4} />
                            )}
                            <rect x={x} y={railY} width={stepW} height={stepH} rx={6} ry={6}
                                fill={isHighlighted ? highlightBg : surfaceColor}
                                stroke={isHighlighted ? highlightColor : color} strokeWidth={isHighlighted ? 2 : 1.5} />
                            <rect x={x + 4} y={railY + 4} width={step.type.length * 6 + 8} height={13} rx={3} ry={3} fill={color + '33'} />
                            <text x={x + 8} y={railY + 13} fontSize={8} fontWeight={600} fill={color} fontFamily="monospace">{step.type.toUpperCase()}</text>
                            <text x={cx} y={railY + 32} textAnchor="middle" fontSize={10}
                                fill={isHighlighted ? highlightText : textColor}
                                fontFamily="monospace" fontWeight={isHighlighted ? 700 : 500}>{step.name}</text>
                            <line x1={cx} y1={railY + stepH} x2={cx} y2={failExitY}
                                stroke={isHighlighted ? failColor + '99' : failColor + '44'}
                                strokeWidth={1} strokeDasharray="4 3" />
                            {isHighlighted && tracedFailure && (
                                <text x={cx} y={failExitY + 12} textAnchor="middle" fontSize={8} fill={failColor}
                                    fontFamily="monospace" fontWeight={600}>{tracedFailure}</text>
                            )}
                            <text x={cx} y={railY - 6} textAnchor="middle" fontSize={9} fill={mutedColor}>{i + 1}</text>
                        </g>
                    )
                })}

                {(() => {
                    const endX = startX + (steps.length - 1) * (stepW + gapX) + stepW
                    return (
                        <>
                            <line x1={endX} y1={railY + stepH / 2} x2={endX + 30} y2={railY + stepH / 2} stroke={borderColor} strokeWidth={2} />
                            <circle cx={endX + 44} cy={railY + stepH / 2} r={10} fill={successBg} stroke={successColor} strokeWidth={1.5} />
                            <text x={endX + 44} y={railY + stepH / 2 + 4} textAnchor="middle" fontSize={13} fill={successColor}>&#x2713;</text>
                        </>
                    )
                })()}
            </svg>
        </div>
    )
}
