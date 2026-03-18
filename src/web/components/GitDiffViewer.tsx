import { useEffect, useState } from 'react'
import { Paper, Group, Badge, SegmentedControl, Select, Button, Text, Code, Stack, Loader, Title, Alert } from '@mantine/core'

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
    const [selectedRef, setSelectedRef] = useState<string | null>(null)
    const [diffResult, setDiffResult] = useState<DiffResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [refType, setRefType] = useState('commit')

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

    const selectOptions = refType === 'commit'
        ? (refs?.commits.map(c => ({ value: c.hash, label: `${c.hash} ${c.message}` })) || [])
        : (refs?.branches.filter(b => b !== refs.currentBranch).map(b => ({ value: b, label: b })) || [])

    return (
        <div style={{ padding: 24 }}>
            <Paper p="md" radius="md" withBorder mb="lg">
                <Title order={4} mb="xs">Spec Diff</Title>
                <Text size="xs" c="dimmed" mb="sm">
                    Compare current specs against a previous git ref.
                    {refs && <> On branch <Code fz="xs">{refs.currentBranch}</Code></>}
                </Text>

                <Group>
                    <SegmentedControl
                        size="xs"
                        value={refType}
                        onChange={v => { setRefType(v); setSelectedRef(null) }}
                        data={[
                            { label: 'Commits', value: 'commit' },
                            { label: 'Branches', value: 'branch' },
                        ]}
                    />
                    <Select
                        size="xs"
                        placeholder={`Select a ${refType}...`}
                        data={selectOptions}
                        value={selectedRef}
                        onChange={setSelectedRef}
                        searchable
                        style={{ flex: 1 }}
                        ff="monospace"
                    />
                    <Button
                        size="xs"
                        color="green"
                        onClick={runDiff}
                        disabled={!selectedRef}
                        loading={loading}
                    >
                        Compare
                    </Button>
                </Group>
            </Paper>

            {error && <Alert color="red" mb="md">{error}</Alert>}

            {loading && (
                <Group justify="center" p="xl">
                    <Loader size="sm" />
                    <Text size="sm" c="dimmed">
                        Loading specs from <Code fz="xs">{selectedRef}</Code>...
                    </Text>
                </Group>
            )}

            {diffResult && <DiffResults diff={diffResult.diff} gitRef={diffResult.ref} />}
        </div>
    )
}

function DiffResults({ diff, gitRef }: { diff: SpecDiff; gitRef: string }) {
    const totalChanges = diff.added.length + diff.removed.length + diff.changed.length

    if (totalChanges === 0) {
        return (
            <Text ta="center" p="xl" c="green" size="sm">
                No spec changes since <Code fz="xs">{gitRef.substring(0, 8)}</Code>
                <Text size="xs" c="dimmed" mt={4}>{diff.unchanged} specs unchanged</Text>
            </Text>
        )
    }

    return (
        <Stack gap="md">
            <Paper p="xs" radius="md" withBorder>
                <Group gap="sm" fz="xs">
                    <Text size="xs" c="dimmed">Comparing with <Code fz="xs">{gitRef.substring(0, 8)}</Code></Text>
                    {diff.added.length > 0 && <Badge variant="light" color="green" size="sm">{diff.added.length} added</Badge>}
                    {diff.removed.length > 0 && <Badge variant="light" color="red" size="sm">{diff.removed.length} removed</Badge>}
                    {diff.changed.length > 0 && <Badge variant="light" color="yellow" size="sm">{diff.changed.length} changed</Badge>}
                    <Text size="xs" c="dimmed">{diff.unchanged} unchanged</Text>
                </Group>
            </Paper>

            {diff.added.length > 0 && (
                <div>
                    <Title order={5} c="green" mb="xs">Added Specs</Title>
                    <Stack gap={4}>
                        {diff.added.map(s => (
                            <Paper key={s.exportName} p="xs" radius="sm" withBorder>
                                <Group gap="sm">
                                    <Text c="green" fw={600}>+</Text>
                                    <Code fz="xs" c="green">{s.exportName}</Code>
                                    <Text size="xs" c="dimmed">{s.modulePath}</Text>
                                </Group>
                            </Paper>
                        ))}
                    </Stack>
                </div>
            )}

            {diff.removed.length > 0 && (
                <div>
                    <Title order={5} c="red" mb="xs">Removed Specs</Title>
                    <Stack gap={4}>
                        {diff.removed.map(s => (
                            <Paper key={s.exportName} p="xs" radius="sm" withBorder>
                                <Group gap="sm">
                                    <Text c="red" fw={600}>-</Text>
                                    <Code fz="xs" c="red">{s.exportName}</Code>
                                    {s.modulePath && <Text size="xs" c="dimmed">{s.modulePath}</Text>}
                                </Group>
                            </Paper>
                        ))}
                    </Stack>
                </div>
            )}

            {diff.changed.length > 0 && (
                <div>
                    <Title order={5} c="yellow" mb="xs">Changed Specs</Title>
                    <Stack gap="xs">
                        {diff.changed.map(change => (
                            <ChangeDetail key={change.exportName} change={change} />
                        ))}
                    </Stack>
                </div>
            )}
        </Stack>
    )
}

function ChangeDetail({ change }: { change: SpecChange }) {
    return (
        <Paper p="sm" radius="sm" withBorder>
            <Group gap="sm" mb="xs">
                <Text c="yellow" fw={600}>~</Text>
                <Code fz="sm" c="yellow">{change.exportName}</Code>
                <Text size="xs" c="dimmed">{change.modulePath}</Text>
            </Group>

            <Stack gap={2} pl="md">
                {change.failuresAdded.map(f => <DiffLine key={`+f-${f}`} type="+" label="failure" value={f} />)}
                {change.failuresRemoved.map(f => <DiffLine key={`-f-${f}`} type="-" label="failure" value={f} />)}
                {change.successesAdded.map(s => <DiffLine key={`+s-${s}`} type="+" label="success" value={s} />)}
                {change.successesRemoved.map(s => <DiffLine key={`-s-${s}`} type="-" label="success" value={s} />)}
                {change.assertionsAdded.map(a => <DiffLine key={`+a-${a}`} type="+" label="assertion" value={a} />)}
                {change.assertionsRemoved.map(a => <DiffLine key={`-a-${a}`} type="-" label="assertion" value={a} />)}
                {change.stepsAdded.map(s => <DiffLine key={`+st-${s}`} type="+" label="step" value={s} />)}
                {change.stepsRemoved.map(s => <DiffLine key={`-st-${s}`} type="-" label="step" value={s} />)}
                {change.exampleCountChanges.map(c => (
                    <Group key={`ex-${c.group}`} gap="xs" fz="xs">
                        <Text c="yellow" w={12}>~</Text>
                        <Text c="dimmed" miw={60}>examples</Text>
                        <Code fz="xs">{c.group}</Code>
                        <Text c="red">{c.from}</Text>
                        <Text c="dimmed">&rarr;</Text>
                        <Text c="green">{c.to}</Text>
                    </Group>
                ))}
            </Stack>
        </Paper>
    )
}

function DiffLine({ type, label, value }: { type: '+' | '-'; label: string; value: string }) {
    const color = type === '+' ? 'green' : 'red'
    return (
        <Group gap="xs" fz="xs">
            <Text c={color} w={12} fw={600}>{type}</Text>
            <Text c="dimmed" miw={60}>{label}</Text>
            <Code fz="xs" c={color}>{value}</Code>
        </Group>
    )
}
