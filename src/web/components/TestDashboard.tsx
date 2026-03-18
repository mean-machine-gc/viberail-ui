import { useEffect, useState } from 'react'
import { Paper, Group, Badge, SegmentedControl, Text, Code, Stack, Loader, Title, Collapse, UnstyledButton, RingProgress } from '@mantine/core'
import { CaretDown, CaretRight } from '@phosphor-icons/react'

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

function statusColor(status: string): string {
    switch (status) {
        case 'pass': return 'green'
        case 'fail': return 'red'
        case 'skip': return 'violet'
        case 'todo': return 'gray'
        default: return 'gray'
    }
}

export function TestDashboard() {
    const [report, setReport] = useState<TestReport | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [expandedSpec, setExpandedSpec] = useState<string | null>(null)
    const [filter, setFilter] = useState('all')

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

    if (loading) return <Group p="xl"><Loader size="sm" /><Text c="dimmed">Loading test results...</Text></Group>
    if (error) return (
        <div style={{ padding: 32 }}>
            <Text c="yellow" size="sm" mb="xs">No test results available</Text>
            <Code block fz="xs">{error}</Code>
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
            <Paper p="sm" radius="md" withBorder mb="lg">
                <Group wrap="wrap">
                    <Title order={4}>Test Results</Title>

                    <RingProgress
                        size={40}
                        thickness={4}
                        roundCaps
                        sections={[{ value: passRate * 100, color: report.failed > 0 ? 'red' : 'green' }]}
                        label={<Text ta="center" fz={9} fw={700}>{Math.round(passRate * 100)}%</Text>}
                    />

                    <Badge variant="light" color="green">{report.passed} passed</Badge>
                    <Badge variant="light" color="red">{report.failed} failed</Badge>
                    <Badge variant="light" color="violet">{report.skipped} skipped</Badge>
                    {report.todo > 0 && <Badge variant="light" color="gray">{report.todo} todo</Badge>}

                    <Text size="xs" c="dimmed">
                        {report.totalSpecs} specs &middot; {report.totalTests} tests &middot; {(report.duration / 1000).toFixed(1)}s
                    </Text>

                    <div style={{ marginLeft: 'auto' }}>
                        <SegmentedControl
                            size="xs"
                            value={filter}
                            onChange={setFilter}
                            data={[
                                { label: 'All', value: 'all' },
                                { label: 'Failed', value: 'failed' },
                                { label: 'Skipped', value: 'skipped' },
                            ]}
                        />
                    </div>
                </Group>
            </Paper>

            <Text size="xs" c="dimmed" mb="md">
                Results from {new Date(report.timestamp).toLocaleString()}
            </Text>

            <Stack gap={4}>
                {filteredSpecs.map(spec => {
                    const expanded = expandedSpec === spec.specName
                    const hasFailure = spec.failed > 0
                    const allPass = spec.failed === 0 && spec.passed > 0

                    return (
                        <Paper key={spec.specName} radius="sm" withBorder
                            style={{ borderColor: hasFailure ? 'var(--mantine-color-red-9)' : undefined }}
                        >
                            <UnstyledButton
                                onClick={() => setExpandedSpec(expanded ? null : spec.specName)}
                                w="100%" p="xs"
                            >
                                <Group gap="sm">
                                    {expanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
                                    <span style={{
                                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                        background: hasFailure ? 'var(--mantine-color-red-6)' : allPass ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-yellow-6)',
                                    }} />
                                    <Text ff="monospace" size="sm" c={hasFailure ? 'red' : undefined} fw={hasFailure ? 600 : 400}>
                                        {spec.specName}
                                    </Text>
                                    <Group gap="xs" ml="auto">
                                        {spec.passed > 0 && <Text size="xs" c="green">{spec.passed} passed</Text>}
                                        {spec.failed > 0 && <Text size="xs" c="red">{spec.failed} failed</Text>}
                                        {spec.skipped > 0 && <Text size="xs" c="violet">{spec.skipped} skipped</Text>}
                                        {spec.todo > 0 && <Text size="xs" c="dimmed">{spec.todo} todo</Text>}
                                    </Group>
                                </Group>
                            </UnstyledButton>

                            <Collapse in={expanded}>
                                <div style={{ padding: '0 12px 12px 38px' }}>
                                    {Object.keys(spec.failures).length > 0 && (
                                        <div style={{ marginTop: 8 }}>
                                            <Text size="xs" fw={600} c="red" tt="uppercase" mb={4}>Failures</Text>
                                            {Object.entries(spec.failures).map(([key, group]) => (
                                                <GroupDetail key={key} name={key} group={group} color="red" />
                                            ))}
                                        </div>
                                    )}

                                    {Object.keys(spec.successes).length > 0 && (
                                        <div style={{ marginTop: 8 }}>
                                            <Text size="xs" fw={600} c="green" tt="uppercase" mb={4}>Successes</Text>
                                            {Object.entries(spec.successes).map(([key, group]) => (
                                                <div key={key}>
                                                    <GroupDetail name={key} group={group} color="green" />
                                                    {Object.keys(group.assertions).length > 0 && (
                                                        <div style={{ marginLeft: 16, marginTop: 4 }}>
                                                            {Object.entries(group.assertions).map(([aName, assertion]) => (
                                                                <div key={aName} style={{ marginBottom: 4 }}>
                                                                    <Text size="xs" c="violet" ff="monospace" mb={2}>
                                                                        assert: {assertion.description}
                                                                    </Text>
                                                                    {assertion.examples.map((ex, i) => (
                                                                        <ExampleRow key={i} example={ex} />
                                                                    ))}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </Collapse>
                        </Paper>
                    )
                })}
            </Stack>
        </div>
    )
}

function GroupDetail({ name, group, color }: {
    name: string; group: GroupTestResult; color: string
}) {
    return (
        <div style={{ marginBottom: 6 }}>
            <Group gap="xs" mb={2}>
                <Code fz="xs" c={color}>{name}</Code>
                <Badge size="xs" variant="light" color={statusColor(group.status)} tt="uppercase">{group.status}</Badge>
            </Group>
            {group.examples.map((ex, i) => (
                <ExampleRow key={i} example={ex} />
            ))}
        </div>
    )
}

function ExampleRow({ example }: { example: ExampleResult }) {
    return (
        <Group gap="xs" fz="xs" pl="xs" mb={1}>
            <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: example.status === 'pass' ? 'var(--mantine-color-green-6)'
                    : example.status === 'fail' ? 'var(--mantine-color-red-6)'
                    : 'var(--mantine-color-gray-6)',
            }} />
            <Text size="xs" c={example.status === 'fail' ? 'red' : undefined}>{example.description}</Text>
            {example.duration != null && <Text size="xs" c="dimmed">{example.duration}ms</Text>}
            {example.failureMessage && (
                <Text size="xs" c="red" maw={400} truncate>{example.failureMessage.split('\n')[0]}</Text>
            )}
        </Group>
    )
}
