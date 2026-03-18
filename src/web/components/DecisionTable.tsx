import { Table, Badge, Text } from '@mantine/core'

type Step = { name: string; type: string; description: string; handlers?: string[] }
type FailGroup = { description: string; exampleCount: number; examples: Array<{ description: string }>; coveredBy?: string }
type SuccessGroup = { description: string; exampleCount: number; examples: Array<{ description: string }> }

type Props = {
    steps?: Step[]
    shouldFailWith: Record<string, FailGroup>
    shouldSucceedWith: Record<string, SuccessGroup>
}

type Row = {
    scenario: string
    description: string
    outcome: string
    outcomeType: 'fail' | 'success'
    stepResults: Record<string, 'pass' | 'FAIL' | '--'>
}

function buildRows(props: Props): Row[] {
    const { steps, shouldFailWith, shouldSucceedWith } = props
    const stepNames = (steps || []).map(s => s.name)
    const rows: Row[] = []

    for (const [code, group] of Object.entries(shouldFailWith)) {
        let failStepName: string | null = null
        if (group.coveredBy) {
            const parts = group.coveredBy.split(' → ').map(s => s.trim())
            failStepName = parts[0]
        }

        const stepResults: Record<string, 'pass' | 'FAIL' | '--'> = {}
        if (steps) {
            let failed = false
            for (const s of stepNames) {
                if (failed) {
                    stepResults[s] = '--'
                } else if (s === failStepName) {
                    stepResults[s] = 'FAIL'
                    failed = true
                } else {
                    stepResults[s] = 'pass'
                }
            }
            if (!failed) {
                for (const s of stepNames) stepResults[s] = 'pass'
                if (stepNames.length > 0) stepResults[stepNames[stepNames.length - 1]] = 'FAIL'
            }
        }

        if (group.examples.length > 0) {
            for (const ex of group.examples) {
                rows.push({ scenario: ex.description, description: group.description, outcome: code, outcomeType: 'fail', stepResults: { ...stepResults } })
            }
        } else {
            rows.push({ scenario: group.description, description: group.description, outcome: code, outcomeType: 'fail', stepResults: { ...stepResults } })
        }
    }

    for (const [type, group] of Object.entries(shouldSucceedWith)) {
        const stepResults: Record<string, 'pass' | 'FAIL' | '--'> = {}
        if (steps) {
            for (const s of stepNames) stepResults[s] = 'pass'
        }

        if (group.examples.length > 0) {
            for (const ex of group.examples) {
                rows.push({ scenario: ex.description, description: group.description, outcome: type, outcomeType: 'success', stepResults: { ...stepResults } })
            }
        } else {
            rows.push({ scenario: group.description, description: group.description, outcome: type, outcomeType: 'success', stepResults: { ...stepResults } })
        }
    }

    return rows
}

function cellColor(result: 'pass' | 'FAIL' | '--'): string {
    switch (result) {
        case 'pass': return 'green'
        case 'FAIL': return 'red'
        case '--': return 'gray'
    }
}

export function DecisionTable(props: Props) {
    const rows = buildRows(props)
    const stepNames = (props.steps || []).map(s => s.name)
    const isPipeline = stepNames.length > 0

    if (rows.length === 0) return null

    return (
        <div style={{ overflowX: 'auto' }}>
            <Table fz="xs" ff="monospace" horizontalSpacing="xs" verticalSpacing={4}>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Scenario</Table.Th>
                        {isPipeline && stepNames.map(s => (
                            <Table.Th key={s} ta="center" miw={70}>{s}</Table.Th>
                        ))}
                        <Table.Th ta="center" miw={100}>Outcome</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {rows.map((row, i) => (
                        <Table.Tr key={i}>
                            <Table.Td maw={300} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <Text size="xs" ff="var(--mantine-font-family)">{row.scenario}</Text>
                            </Table.Td>
                            {isPipeline && stepNames.map(s => {
                                const result = row.stepResults[s]
                                return (
                                    <Table.Td key={s} ta="center">
                                        <Badge size="xs" variant="light" color={cellColor(result)}>{result}</Badge>
                                    </Table.Td>
                                )
                            })}
                            <Table.Td ta="center">
                                <Text size="xs" fw={600} c={row.outcomeType === 'fail' ? 'red' : 'green'} ff="monospace">
                                    {row.outcome}
                                </Text>
                            </Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
        </div>
    )
}
