import { useEffect, useState } from 'react'
import { useSpecRevision } from '../hooks/useSpecRevision'
import { TextInput, Text, Badge, Group, Collapse, UnstyledButton, Loader, Stack } from '@mantine/core'
import { MagnifyingGlass, CaretDown, CaretRight } from '@phosphor-icons/react'

type SerializedSpec = {
    exportName: string
    modulePath: string
    steps?: Array<{ name: string }>
    shouldFailWith: Record<string, { exampleCount: number }>
    shouldSucceedWith: Record<string, { exampleCount: number }>
}

type DomainGroup = {
    domain: string
    specs: SerializedSpec[]
}

function extractDomain(modulePath: string): string {
    const match = modulePath.match(/src\/domain\/([^/]+)/)
    return match ? match[1] : 'other'
}

function groupByDomain(specs: SerializedSpec[]): DomainGroup[] {
    const map = new Map<string, SerializedSpec[]>()
    for (const spec of specs) {
        const domain = extractDomain(spec.modulePath)
        if (!map.has(domain)) map.set(domain, [])
        map.get(domain)!.push(spec)
    }
    return [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([domain, specs]) => ({ domain, specs: specs.sort((a, b) => a.exportName.localeCompare(b.exportName)) }))
}

export function SpecBrowser({ onSelectSpec }: { onSelectSpec: (name: string) => void }) {
    const [specs, setSpecs] = useState<SerializedSpec[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
    const revision = useSpecRevision()

    useEffect(() => {
        fetch('/api/specs')
            .then(r => r.json())
            .then(d => { setSpecs(d.specs || []); setLoading(false) })
            .catch(() => setLoading(false))
    }, [revision])

    if (loading) return <Group p="xl"><Loader size="sm" /><Text c="dimmed">Loading specs...</Text></Group>

    const filtered = search
        ? specs.filter(s => s.exportName.toLowerCase().includes(search.toLowerCase()))
        : specs

    const groups = groupByDomain(filtered)

    const toggleDomain = (domain: string) => {
        setCollapsed(prev => {
            const next = new Set(prev)
            next.has(domain) ? next.delete(domain) : next.add(domain)
            return next
        })
    }

    return (
        <div style={{ padding: 24, maxWidth: 900 }}>
            <Text fw={700} size="lg" mb="md">Specs</Text>

            <TextInput
                placeholder="Search specs..."
                leftSection={<MagnifyingGlass size={16} />}
                value={search}
                onChange={e => setSearch(e.currentTarget.value)}
                maw={400}
                mb="md"
                size="sm"
            />

            <Text size="xs" c="dimmed" mb="md">
                {filtered.length} spec{filtered.length !== 1 ? 's' : ''} across {groups.length} domain{groups.length !== 1 ? 's' : ''}
            </Text>

            <Stack gap="md">
                {groups.map(({ domain, specs: domainSpecs }) => {
                    const isCollapsed = collapsed.has(domain)
                    return (
                        <div key={domain}>
                            <UnstyledButton onClick={() => toggleDomain(domain)}>
                                <Group gap="xs">
                                    {isCollapsed ? <CaretRight size={14} /> : <CaretDown size={14} />}
                                    <Text fw={600} size="sm" c="blue">{domain}</Text>
                                    <Text size="xs" c="dimmed">({domainSpecs.length})</Text>
                                </Group>
                            </UnstyledButton>
                            <Collapse in={!isCollapsed}>
                                <Stack gap={4} ml="lg" mt="xs">
                                    {domainSpecs.map(spec => {
                                        const failCount = Object.keys(spec.shouldFailWith).length
                                        const successCount = Object.keys(spec.shouldSucceedWith).length
                                        const isPipeline = !!spec.steps && spec.steps.length > 0
                                        return (
                                            <UnstyledButton
                                                key={spec.exportName}
                                                onClick={() => onSelectSpec(spec.exportName)}
                                                p="xs"
                                                style={{ borderRadius: 'var(--mantine-radius-sm)' }}
                                                className="mantine-hover"
                                            >
                                                <Group gap="xs">
                                                    <Text ff="monospace" fw={500} size="sm">{spec.exportName}</Text>
                                                    <Badge size="xs" variant="light" color={isPipeline ? 'blue' : 'gray'}>
                                                        {isPipeline ? 'pipeline' : 'atomic'}
                                                    </Badge>
                                                    <Text size="xs" c="red">{failCount}F</Text>
                                                    <Text size="xs" c="green">{successCount}S</Text>
                                                </Group>
                                            </UnstyledButton>
                                        )
                                    })}
                                </Stack>
                            </Collapse>
                        </div>
                    )
                })}
            </Stack>
        </div>
    )
}
