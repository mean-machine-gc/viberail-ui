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

    // Failure rows
    for (const [code, group] of Object.entries(shouldFailWith)) {
        // Determine which step fails
        let failStepName: string | null = null
        if (group.coveredBy) {
            // coveredBy is "stepA → stepB → stepC" — last step in the chain is where it fails
            const parts = group.coveredBy.split(' → ').map(s => s.trim())
            failStepName = parts[0] // first in trail is the direct step in this pipeline
        } else if (steps) {
            // Not inherited — find which step owns this failure by matching step name in the code
            // For non-inherited failures in a pipeline, the failure belongs to the pipeline itself
            // We'll mark the last step as the failure point
            failStepName = null
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
            // If no specific step matched, mark all as pass (failure is at pipeline level)
            if (!failed) {
                for (const s of stepNames) stepResults[s] = 'pass'
                // Mark the last step as FAIL for pipeline-level failures
                if (stepNames.length > 0) stepResults[stepNames[stepNames.length - 1]] = 'FAIL'
            }
        }

        if (group.examples.length > 0) {
            for (const ex of group.examples) {
                rows.push({
                    scenario: ex.description,
                    description: group.description,
                    outcome: code,
                    outcomeType: 'fail',
                    stepResults: { ...stepResults },
                })
            }
        } else {
            rows.push({
                scenario: group.description,
                description: group.description,
                outcome: code,
                outcomeType: 'fail',
                stepResults: { ...stepResults },
            })
        }
    }

    // Success rows
    for (const [type, group] of Object.entries(shouldSucceedWith)) {
        const stepResults: Record<string, 'pass' | 'FAIL' | '--'> = {}
        if (steps) {
            for (const s of stepNames) stepResults[s] = 'pass'
        }

        if (group.examples.length > 0) {
            for (const ex of group.examples) {
                rows.push({
                    scenario: ex.description,
                    description: group.description,
                    outcome: type,
                    outcomeType: 'success',
                    stepResults: { ...stepResults },
                })
            }
        } else {
            rows.push({
                scenario: group.description,
                description: group.description,
                outcome: type,
                outcomeType: 'success',
                stepResults: { ...stepResults },
            })
        }
    }

    return rows
}

export function DecisionTable(props: Props) {
    const rows = buildRows(props)
    const stepNames = (props.steps || []).map(s => s.name)
    const isPipeline = stepNames.length > 0

    if (rows.length === 0) return null

    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 12,
                fontFamily: 'monospace',
            }}>
                <thead>
                    <tr>
                        <th style={thStyle}>Scenario</th>
                        {isPipeline && stepNames.map(s => (
                            <th key={s} style={{ ...thStyle, textAlign: 'center', minWidth: 70 }}>{s}</th>
                        ))}
                        <th style={{ ...thStyle, textAlign: 'center', minWidth: 100 }}>Outcome</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #21262d' }}>
                            <td style={{
                                ...tdStyle,
                                maxWidth: 300,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                color: '#c9d1d9',
                                fontFamily: 'system-ui, sans-serif',
                            }}>
                                {row.scenario}
                            </td>
                            {isPipeline && stepNames.map(s => {
                                const result = row.stepResults[s]
                                return (
                                    <td key={s} style={{ ...tdStyle, textAlign: 'center' }}>
                                        <span style={{
                                            fontSize: 10,
                                            fontWeight: 600,
                                            padding: '2px 6px',
                                            borderRadius: 3,
                                            ...cellColors(result),
                                        }}>
                                            {result}
                                        </span>
                                    </td>
                                )
                            })}
                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                <span style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: row.outcomeType === 'fail' ? '#f85149' : '#7ee787',
                                }}>
                                    {row.outcome}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function cellColors(result: 'pass' | 'FAIL' | '--'): React.CSSProperties {
    switch (result) {
        case 'pass': return { background: '#1a3a2a', color: '#7ee787' }
        case 'FAIL': return { background: '#3d1f1f', color: '#f85149' }
        case '--': return { background: 'transparent', color: '#484f58' }
    }
}

const thStyle: React.CSSProperties = {
    padding: '8px 10px',
    textAlign: 'left',
    color: '#8b949e',
    fontWeight: 600,
    fontSize: 11,
    borderBottom: '2px solid #30363d',
    whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
    padding: '6px 10px',
}
