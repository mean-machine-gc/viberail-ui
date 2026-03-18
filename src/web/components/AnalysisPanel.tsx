import { useEffect, useState } from 'react'
import { useSpecRevision } from '../hooks/useSpecRevision'
import { Paper, Group, Badge, SegmentedControl, Text, Code, Stack, Loader, Title } from '@mantine/core'

type CheckResult = {
    specFile: string
    specName: string
    check: string
    severity: 'error' | 'warning'
    message: string
}

type AnalysisData = {
    results: CheckResult[]
    summary: { errors: number; warnings: number; specCount: number }
}

export function AnalysisPanel() {
    const [data, setData] = useState<AnalysisData | null>(null)
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [checkFilter, setCheckFilter] = useState('all')
    const revision = useSpecRevision()

    useEffect(() => {
        fetch('/api/analysis')
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false) })
            .catch(() => setLoading(false))
    }, [revision])

    if (loading) return <Group p="xl"><Loader size="sm" /><Text c="dimmed">Running checks...</Text></Group>
    if (!data) return <Text p="xl" c="red">Failed to load analysis</Text>

    const filtered = data.results.filter(r => {
        if (filter !== 'all' && r.severity !== filter) return false
        if (checkFilter !== 'all' && r.check !== checkFilter) return false
        return true
    })

    const byFile = new Map<string, CheckResult[]>()
    for (const r of filtered) {
        const list = byFile.get(r.specFile) || []
        list.push(r)
        byFile.set(r.specFile, list)
    }

    const checkNames = [...new Set(data.results.map(r => r.check))]

    return (
        <div style={{ padding: 24, maxWidth: 1000 }}>
            <Paper p="sm" radius="md" withBorder mb="lg">
                <Group>
                    <Title order={4}>Analysis</Title>
                    <Text size="sm" c="dimmed">{data.summary.specCount} specs</Text>
                    <Badge variant="light" color="red">{data.summary.errors} error{data.summary.errors !== 1 ? 's' : ''}</Badge>
                    <Badge variant="light" color="yellow">{data.summary.warnings} warning{data.summary.warnings !== 1 ? 's' : ''}</Badge>
                    <div style={{ marginLeft: 'auto' }}>
                        <SegmentedControl
                            size="xs"
                            value={filter}
                            onChange={setFilter}
                            data={[
                                { label: 'All', value: 'all' },
                                { label: 'Errors', value: 'error' },
                                { label: 'Warnings', value: 'warning' },
                            ]}
                        />
                    </div>
                </Group>
            </Paper>

            <Group gap="xs" mb="md">
                <SegmentedControl
                    size="xs"
                    value={checkFilter}
                    onChange={setCheckFilter}
                    data={[
                        { label: 'all checks', value: 'all' },
                        ...checkNames.map(name => ({ label: name, value: name })),
                    ]}
                />
            </Group>

            {filtered.length === 0 ? (
                <Text ta="center" p="xl" c="green" size="sm">No issues found</Text>
            ) : (
                <Stack gap="sm">
                    {[...byFile.entries()].map(([file, results]) => (
                        <Paper key={file} radius="md" withBorder style={{ overflow: 'hidden' }}>
                            <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                                <Code fz="xs">{file}</Code>
                            </div>
                            {results.map((r, i) => (
                                <Group key={i} px="sm" py={4} gap="sm"
                                    style={{ borderBottom: i < results.length - 1 ? '1px solid var(--mantine-color-default-border)' : 'none' }}
                                >
                                    <Badge size="xs" variant="light" color={r.severity === 'error' ? 'red' : 'yellow'} tt="uppercase">
                                        {r.severity}
                                    </Badge>
                                    <Code fz="xs" c="dimmed" miw={160}>{r.check}</Code>
                                    <Text size="sm">{r.message}</Text>
                                </Group>
                            ))}
                        </Paper>
                    ))}
                </Stack>
            )}
        </div>
    )
}
