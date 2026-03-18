import { useEffect, useState } from 'react'
import { useSpecRevision } from '../hooks/useSpecRevision'
import { Paper, Group, Badge, SegmentedControl, Text, Tooltip, UnstyledButton, Loader, Progress, Title } from '@mantine/core'

type SerializedSpec = {
    exportName: string
    modulePath: string
    shouldFailWith: Record<string, { description: string; exampleCount: number; examples: Array<{ description: string }>; coveredBy?: string }>
    shouldSucceedWith: Record<string, { description: string; exampleCount: number; examples: Array<{ description: string }> }>
    shouldAssert: Record<string, Record<string, { description: string }>>
}

type SpecsData = { specs: SerializedSpec[]; count: number }

type CellStatus = 'covered' | 'covered-by' | 'missing' | 'na'

function cellDotColor(status: CellStatus, success?: boolean): string {
    switch (status) {
        case 'covered': return success ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-blue-6)'
        case 'covered-by': return 'var(--mantine-color-violet-6)'
        case 'missing': return 'var(--mantine-color-red-6)'
        case 'na': return 'var(--mantine-color-gray-7)'
    }
}

function CellDot({ status, success }: { status: CellStatus; success?: boolean }) {
    return (
        <span style={{
            display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
            background: cellDotColor(status, success),
            border: status === 'missing' ? '1px solid var(--mantine-color-red-9)' : 'none',
            flexShrink: 0,
        }} />
    )
}

export function CoverageMatrix({ onSelectSpec }: { onSelectSpec: (name: string) => void }) {
    const [specs, setSpecs] = useState<SerializedSpec[]>([])
    const [loading, setLoading] = useState(true)
    const [showOnly, setShowOnly] = useState('all')
    const revision = useSpecRevision()

    useEffect(() => {
        fetch('/api/specs')
            .then(r => r.json())
            .then((d: SpecsData) => { setSpecs(d.specs); setLoading(false) })
            .catch(() => setLoading(false))
    }, [revision])

    if (loading) return <Group p="xl"><Loader size="sm" /><Text c="dimmed">Loading coverage matrix...</Text></Group>

    const rows = specs.map(spec => {
        const failCols = Object.entries(spec.shouldFailWith).map(([key, g]) => ({
            key, kind: 'failure' as const,
            status: (g.coveredBy ? 'covered-by' : g.exampleCount > 0 ? 'covered' : 'missing') as CellStatus,
            description: g.description, exampleCount: g.exampleCount, coveredBy: g.coveredBy, examples: g.examples,
        }))
        const successCols = Object.entries(spec.shouldSucceedWith).map(([key, g]) => {
            const assertions = spec.shouldAssert[key] || {}
            return {
                key, kind: 'success' as const,
                status: (g.exampleCount > 0 ? 'covered' : 'missing') as CellStatus,
                description: g.description, exampleCount: g.exampleCount, assertCount: Object.keys(assertions).length, examples: g.examples,
            }
        })
        const totalGroups = failCols.length + successCols.length
        const coveredGroups = [...failCols, ...successCols].filter(c => c.status === 'covered' || c.status === 'covered-by').length
        return { spec, failCols, successCols, totalGroups, coveredGroups, coverage: totalGroups > 0 ? coveredGroups / totalGroups : 1 }
    })

    const filteredRows = showOnly === 'gaps' ? rows.filter(r => r.coverage < 1) : rows
    const totalMissing = rows.reduce((sum, r) => sum + [...r.failCols, ...r.successCols].filter(c => c.status === 'missing').length, 0)
    const totalGroups = rows.reduce((sum, r) => sum + r.totalGroups, 0)

    return (
        <div style={{ padding: 24 }}>
            <Paper p="sm" radius="md" withBorder mb="lg">
                <Group>
                    <Title order={4}>Coverage Matrix</Title>
                    <Text size="sm" c="dimmed">{specs.length} specs</Text>
                    <Badge variant="light" color={totalMissing > 0 ? 'red' : 'green'}>
                        {totalMissing} gap{totalMissing !== 1 ? 's' : ''} / {totalGroups} groups
                    </Badge>
                    <div style={{ marginLeft: 'auto' }}>
                        <SegmentedControl
                            size="xs"
                            value={showOnly}
                            onChange={setShowOnly}
                            data={[
                                { label: 'All', value: 'all' },
                                { label: 'Gaps only', value: 'gaps' },
                            ]}
                        />
                    </div>
                </Group>
            </Paper>

            <Group gap="md" mb="md" fz="xs">
                <Group gap={4}><CellDot status="covered" /> <Text size="xs" c="dimmed">Covered</Text></Group>
                <Group gap={4}><CellDot status="covered-by" /> <Text size="xs" c="dimmed">Covered by step</Text></Group>
                <Group gap={4}><CellDot status="missing" /> <Text size="xs" c="dimmed">Missing</Text></Group>
            </Group>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredRows.map(row => (
                    <Paper key={row.spec.exportName} p="xs" radius="sm" withBorder>
                        <Group gap="sm" wrap="nowrap">
                            <UnstyledButton onClick={() => onSelectSpec(row.spec.exportName)} miw={220} style={{ flexShrink: 0 }}>
                                <Text ff="monospace" size="xs" c="blue" td="none"
                                    style={{ '&:hover': { textDecoration: 'underline' } } as any}
                                >
                                    {row.spec.exportName}
                                </Text>
                            </UnstyledButton>

                            <Progress
                                value={row.coverage * 100}
                                color={row.coverage === 1 ? 'green' : row.coverage >= 0.5 ? 'yellow' : 'red'}
                                size={4} w={40} style={{ flexShrink: 0 }}
                            />

                            {row.failCols.map(col => (
                                <Tooltip key={col.key} label={
                                    <div>
                                        <Text size="xs" c="red" fw={600}>{col.key}</Text>
                                        <Text size="xs">{col.description}</Text>
                                        <Text size="xs" mt={4}>
                                            {col.coveredBy
                                                ? <Text span c="blue" size="xs">Covered by: {col.coveredBy}</Text>
                                                : `${col.exampleCount} example${col.exampleCount !== 1 ? 's' : ''}`
                                            }
                                        </Text>
                                    </div>
                                } multiline w={250}>
                                    <span><CellDot status={col.status} /></span>
                                </Tooltip>
                            ))}

                            {row.failCols.length > 0 && row.successCols.length > 0 && (
                                <div style={{ width: 1, height: 12, background: 'var(--mantine-color-default-border)', flexShrink: 0 }} />
                            )}

                            {row.successCols.map(col => (
                                <Tooltip key={col.key} label={
                                    <div>
                                        <Text size="xs" c="green" fw={600}>{col.key}</Text>
                                        <Text size="xs">{col.description}</Text>
                                        <Text size="xs" mt={4}>
                                            {col.exampleCount} example{col.exampleCount !== 1 ? 's' : ''}, {col.assertCount} assertion{col.assertCount !== 1 ? 's' : ''}
                                        </Text>
                                    </div>
                                } multiline w={250}>
                                    <span><CellDot status={col.status} success /></span>
                                </Tooltip>
                            ))}

                            <Text ff="monospace" size="xs" ml="auto"
                                c={row.coverage === 1 ? 'green' : row.coverage >= 0.5 ? 'yellow' : 'red'}
                            >
                                {Math.round(row.coverage * 100)}%
                            </Text>
                        </Group>
                    </Paper>
                ))}
            </div>
        </div>
    )
}
