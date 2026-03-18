import { useEffect, useState } from 'react'
import { Paper, Group, Badge, Button, Text, Code, Stack, Loader, Title, Collapse, UnstyledButton, Table, useMantineTheme } from '@mantine/core'
import { CaretRight } from '@phosphor-icons/react'
import { DecisionTable } from './DecisionTable'
import { useDiagramColors } from '../hooks/useDiagramColors'

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
    const name = exportName.replace(/Spec$/, '')
    return name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, s => s.toUpperCase())
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

    if (loading) return <Group p="xl"><Loader size="sm" /><Text c="dimmed">Loading...</Text></Group>
    if (!spec) return <Text p="xl" c="red">Spec not found</Text>

    const failEntries = Object.entries(spec.shouldFailWith)
    const successEntries = Object.entries(spec.shouldSucceedWith)
    const totalExamples = failEntries.reduce((n, [, g]) => n + g.exampleCount, 0)
        + successEntries.reduce((n, [, g]) => n + g.exampleCount, 0)
    const totalAssertions = Object.values(spec.shouldAssert).reduce((n, a) => n + Object.keys(a).length, 0)
    const isPipeline = !!spec.steps && spec.steps.length > 0

    const tracedSteps = new Set<string>()
    if (tracedFailure && spec.shouldFailWith[tracedFailure]?.coveredBy) {
        for (const part of spec.shouldFailWith[tracedFailure].coveredBy!.split(' → ')) {
            tracedSteps.add(part.trim())
        }
    }

    return (
        <div>
            <Title order={3} mb={4}>{humanize(spec.exportName)}</Title>
            <Text size="sm" c="dimmed" ff="monospace" mb="sm">{spec.modulePath}</Text>

            <Group gap="xs" mb="lg" wrap="wrap">
                <Badge variant="light" color="blue">{isPipeline ? `Pipeline (${spec.steps!.length} steps)` : 'Atomic'}</Badge>
                <Badge variant="light" color="red">{failEntries.length} failure{failEntries.length !== 1 ? 's' : ''}</Badge>
                <Badge variant="light" color="green">{successEntries.length} success type{successEntries.length !== 1 ? 's' : ''}</Badge>
                <Badge variant="light" color="violet">{totalAssertions} assertion{totalAssertions !== 1 ? 's' : ''}</Badge>
                <Badge variant="light" color="gray">{totalExamples} example{totalExamples !== 1 ? 's' : ''}</Badge>
            </Group>

            <Text size="sm" c="dimmed" mb="lg" lh={1.6}>
                {isPipeline && (
                    <>Executes {spec.steps!.length} steps: {spec.steps!.map((s, i) => (
                        <span key={i}>
                            {i > 0 && <Text span c="dimmed"> &rarr; </Text>}
                            <Code fz="sm">{s.name}</Code>
                        </span>
                    ))}. </>
                )}
                Can fail with {failEntries.length} failure type{failEntries.length !== 1 ? 's' : ''} and
                succeed with {successEntries.length} success type{successEntries.length !== 1 ? 's' : ''}.
            </Text>

            {isPipeline && (
                <Section title="Pipeline">
                    <PipelineDiagram steps={spec.steps!} tracedSteps={tracedSteps} tracedFailure={tracedFailure} />
                </Section>
            )}

            <Section title="Decision Table">
                <DecisionTable steps={spec.steps} shouldFailWith={spec.shouldFailWith} shouldSucceedWith={spec.shouldSucceedWith} />
            </Section>

            <Section title={`Failures (${failEntries.length})`}>
                {failEntries.length === 0 ? (
                    <Text size="sm" c="dimmed">No failure groups declared</Text>
                ) : (
                    <Stack gap="sm">
                        {failEntries.map(([key, group]) => {
                            const isTraced = tracedFailure === key
                            return (
                                <Paper key={key} p="md" radius="md" withBorder
                                    style={{
                                        borderColor: isTraced ? 'var(--mantine-color-blue-6)' : undefined,
                                        background: isTraced ? 'var(--mantine-color-blue-light)' : undefined,
                                    }}
                                >
                                    <Group gap="xs" wrap="wrap">
                                        <Code fz="sm" fw={600} c="red">{key}</Code>
                                        {group.coveredBy && (
                                            <Button size="compact-xs" variant={isTraced ? 'light' : 'subtle'} radius="xl"
                                                onClick={() => setTracedFailure(isTraced ? null : key)}
                                            >
                                                {isTraced ? 'hide trace' : 'trace'}
                                            </Button>
                                        )}
                                        <Text size="xs" c="dimmed">{group.exampleCount} example{group.exampleCount !== 1 ? 's' : ''}</Text>
                                    </Group>
                                    <Text size="sm" mt="xs" lh={1.5}>{group.description}</Text>

                                    {group.coveredBy && (
                                        <Group mt="xs" gap="xs" wrap="wrap">
                                            <Text size="xs" c="dimmed">Inherited from:</Text>
                                            {group.coveredBy.split(' → ').map((step, i, arr) => (
                                                <Group key={i} gap="xs">
                                                    <Code fz="xs" c="blue">{step.trim()}</Code>
                                                    {i < arr.length - 1 && <Text c="dimmed" size="xs">&rarr;</Text>}
                                                </Group>
                                            ))}
                                        </Group>
                                    )}

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
                                        <Stack gap="xs" mt="sm">
                                            {group.examples.map((e, i) => (
                                                <ExampleCard key={i} example={e} />
                                            ))}
                                        </Stack>
                                    )}
                                </Paper>
                            )
                        })}
                    </Stack>
                )}
            </Section>

            <Section title={`Success Types (${successEntries.length})`}>
                <Stack gap="sm">
                    {successEntries.map(([key, group]) => {
                        const assertions = spec.shouldAssert[key] || {}
                        const assertEntries = Object.entries(assertions)
                        return (
                            <Paper key={key} p="md" radius="md" withBorder>
                                <Group gap="xs">
                                    <Code fz="sm" fw={600} c="green">{key}</Code>
                                    <Text size="xs" c="dimmed">{group.exampleCount} example{group.exampleCount !== 1 ? 's' : ''}</Text>
                                    <Badge size="xs" variant="light" color={assertEntries.length > 0 ? 'green' : 'red'}>
                                        {assertEntries.length} assertion{assertEntries.length !== 1 ? 's' : ''}
                                    </Badge>
                                </Group>
                                <Text size="sm" mt="xs" lh={1.5}>{group.description}</Text>

                                {group.examples.length > 0 && (
                                    <Stack gap="xs" mt="sm">
                                        {group.examples.map((e, i) => (
                                            <ExampleCard key={i} example={e} showOutput />
                                        ))}
                                    </Stack>
                                )}

                                {assertEntries.length > 0 && (
                                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--mantine-color-default-border)' }}>
                                        <Text size="xs" c="dimmed" fw={600} mb="xs">Assertions</Text>
                                        <Stack gap={4}>
                                            {assertEntries.map(([name, a]) => (
                                                <Text key={name} size="sm" pl="xs">
                                                    <Code fz="xs" c="violet">{name}</Code>
                                                    <Text span c="dimmed"> &mdash; </Text>
                                                    {a.description}
                                                </Text>
                                            ))}
                                        </Stack>
                                    </div>
                                )}
                            </Paper>
                        )
                    })}
                </Stack>
            </Section>

            {totalAssertions > 0 && successEntries.length > 1 && (
                <Section title="Assertions Summary">
                    <AssertionMatrix shouldSucceedWith={spec.shouldSucceedWith} shouldAssert={spec.shouldAssert} />
                </Section>
            )}
        </div>
    )
}

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
            <Table fz="xs" ff="monospace" horizontalSpacing="xs" verticalSpacing={4}>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th></Table.Th>
                        {successTypes.map(t => <Table.Th key={t} ta="center" c="green">{t}</Table.Th>)}
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {assertionNames.map(name => (
                        <Table.Tr key={name}>
                            <Table.Td c="violet">{name}</Table.Td>
                            {successTypes.map(t => {
                                const has = !!(shouldAssert[t] && shouldAssert[t][name])
                                return (
                                    <Table.Td key={t} ta="center">
                                        <Text c={has ? 'green' : 'dimmed'}>{has ? '●' : '—'}</Text>
                                    </Table.Td>
                                )
                            })}
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
        </div>
    )
}

function PipelineDiagram({ steps, tracedSteps, tracedFailure }: {
    steps: Array<{ name: string; type: string; description: string; handlers?: string[] }>
    tracedSteps: Set<string>
    tracedFailure: string | null
}) {
    const { borderColor, surfaceColor, textColor, mutedColor, highlightColor, highlightBg, highlightText, failColor, successColor, successBg, stepColors } = useDiagramColors()
    const [hoveredStep, setHoveredStep] = useState<number | null>(null)

    const stepW = 150
    const stepH = 44
    const gapX = 60
    const startX = 50
    const railY = 50
    const failExitY = 130
    const totalW = startX + steps.length * (stepW + gapX) + 80
    const totalH = failExitY + 40

    return (
        <div style={{ overflowX: 'auto', marginBottom: 8, position: 'relative' }}>
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
                        <g key={i} onMouseEnter={() => setHoveredStep(i)} onMouseLeave={() => setHoveredStep(null)} style={{ cursor: 'default' }}>
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

                {hoveredStep !== null && (() => {
                    const step = steps[hoveredStep]
                    const x = startX + hoveredStep * (stepW + gapX)
                    return (
                        <foreignObject x={x} y={railY + stepH + 4} width={200} height={40}>
                            <Paper p={4} radius="sm" withBorder style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {step.description}
                            </Paper>
                        </foreignObject>
                    )
                })()}

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

function ExampleCard({ example, showOutput }: { example: ExampleWithData; showOutput?: boolean }) {
    const hasInput = example.whenInput !== undefined
    const hasOutput = showOutput && example.then !== undefined

    if (!hasInput && !hasOutput) {
        return (
            <Text size="sm" pl="xs" style={{ borderLeft: '2px solid var(--mantine-color-default-border)' }} py={4}>
                {example.description}
            </Text>
        )
    }

    return (
        <Paper radius="sm" withBorder style={{ overflow: 'hidden' }}>
            <Text size="sm" p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                {example.description}
            </Text>
            {hasInput && <CollapsibleJson label="Input" data={example.whenInput} />}
            {hasOutput && <CollapsibleJson label="Output" data={example.then} />}
        </Paper>
    )
}

function CollapsibleJson({ label, data }: { label: string; data: unknown }) {
    const [open, setOpen] = useState(false)
    const theme = useMantineTheme()

    return (
        <div style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
            <UnstyledButton onClick={() => setOpen(!open)} w="100%" p="xs">
                <Group gap="xs">
                    <CaretRight size={10} style={{ transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                    <Text size="xs" fw={600} c="dimmed">{label}</Text>
                </Group>
            </UnstyledButton>
            <Collapse in={open}>
                <pre style={{
                    margin: 0, padding: '8px 12px',
                    fontSize: 12, fontFamily: 'var(--mantine-font-family-monospace)',
                    lineHeight: 1.5, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                    {syntaxHighlight(JSON.stringify(data, null, 2), theme)}
                </pre>
            </Collapse>
        </div>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 32 }}>
            <Title order={4} mb="sm" pb="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                {title}
            </Title>
            {children}
        </div>
    )
}

function syntaxHighlight(json: string, theme: ReturnType<typeof useMantineTheme>): React.ReactNode[] {
    const keyColor = theme.colors.blue[4]
    const stringColor = theme.colors.blue[2]
    const numberColor = theme.colors.orange[5]
    const boolColor = theme.colors.red[4]

    const parts: React.ReactNode[] = []
    const regex = /("(?:\\.|[^"\\])*")\s*:/g
    let match
    const keyPositions: Array<{ start: number; end: number }> = []
    while ((match = regex.exec(json)) !== null) {
        keyPositions.push({ start: match.index, end: match.index + match[1].length })
    }

    let i = 0
    let current = ''
    const flush = () => {
        if (current) { parts.push(<span key={parts.length}>{current}</span>); current = '' }
    }

    while (i < json.length) {
        const keyPos = keyPositions.find(p => p.start === i)
        if (keyPos) {
            flush()
            parts.push(<span key={parts.length} style={{ color: keyColor }}>{json.slice(keyPos.start, keyPos.end)}</span>)
            i = keyPos.end; continue
        }
        if (json[i] === '"') {
            flush()
            let j = i + 1
            while (j < json.length && (json[j] !== '"' || json[j - 1] === '\\')) j++
            j++
            parts.push(<span key={parts.length} style={{ color: stringColor }}>{json.slice(i, j)}</span>)
            i = j; continue
        }
        if (/[\d.]/.test(json[i]) && (i === 0 || /[^"\w]/.test(json[i - 1]))) {
            flush()
            let j = i
            while (j < json.length && /[\d.eE+-]/.test(json[j])) j++
            parts.push(<span key={parts.length} style={{ color: numberColor }}>{json.slice(i, j)}</span>)
            i = j; continue
        }
        const remaining = json.slice(i)
        const boolMatch = remaining.match(/^(true|false|null)/)
        if (boolMatch && (i === 0 || /[^"\w]/.test(json[i - 1]))) {
            flush()
            parts.push(<span key={parts.length} style={{ color: boolColor }}>{boolMatch[1]}</span>)
            i += boolMatch[1].length; continue
        }
        current += json[i]; i++
    }
    flush()
    return parts
}
