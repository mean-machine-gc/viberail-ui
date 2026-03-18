// Serialization boundary — strips functions and class instances, extracts structural data

import type { SpecAnalysis, LoadedSpec } from 'viberail'
import { inheritFromSteps } from 'viberail'

export type SerializedSpec = {
    exportName: string
    filePath: string
    modulePath: string
    document?: boolean
    steps?: SerializedStep[]
    shouldFailWith: Record<string, SerializedFailGroup>
    shouldSucceedWith: Record<string, SerializedSuccessGroup>
    shouldAssert: Record<string, Record<string, { description: string }>>
}

export type SerializedStep = {
    name: string
    type: 'step' | 'safe-dep' | 'dep' | 'strategy'
    description: string
    handlers?: string[]  // case names for strategy steps
}

export type SerializedFailGroup = {
    description: string
    exampleCount: number
    examples: Array<{ description: string; whenInput?: unknown }>
    coveredBy?: string
}

export type SerializedSuccessGroup = {
    description: string
    exampleCount: number
    examples: Array<{ description: string; whenInput?: unknown; then?: unknown }>
}

export type SerializedGraphNode = {
    id: string
    name: string
    specPath: string
    domain: string
    edgeCount: number
}

export type SerializedGraphEdge = {
    source: string
    target: string | null
    stepName: string
    type: 'step' | 'safe-dep' | 'dep' | 'strategy'
}

export type SerializedGraph = {
    nodes: SerializedGraphNode[]
    edges: SerializedGraphEdge[]
}

function safeSerialize(value: unknown): unknown {
    try {
        return JSON.parse(JSON.stringify(value))
    } catch {
        return '[unserializable]'
    }
}

export function serializeSpec(loaded: LoadedSpec): SerializedSpec {
    const spec = loaded.spec as any

    // Resolve inherited failures (adds coveredBy breadcrumbs)
    const inherited: Record<string, any> = spec.steps ? inheritFromSteps(spec.steps) : {}

    const shouldFailWith: Record<string, SerializedFailGroup> = {}

    // Start with inherited failures (they have coveredBy trails)
    for (const [key, group] of Object.entries(inherited)) {
        shouldFailWith[key] = {
            description: group.description || '',
            exampleCount: group.examples?.length || 0,
            examples: (group.examples || []).map((e: any) => ({
                description: e.description || '',
                ...(e.whenInput !== undefined ? { whenInput: safeSerialize(e.whenInput) } : {}),
            })),
            coveredBy: group.coveredBy,
        }
    }

    // Overlay explicit failures (overrides inherited ones)
    for (const [key, group] of Object.entries(spec.shouldFailWith || {}) as any[]) {
        if (!group) continue
        shouldFailWith[key] = {
            description: group.description || '',
            exampleCount: group.examples?.length || 0,
            examples: (group.examples || []).map((e: any) => ({
                description: e.description || '',
                ...(e.whenInput !== undefined ? { whenInput: safeSerialize(e.whenInput) } : {}),
            })),
            ...(group.coveredBy ? { coveredBy: group.coveredBy } : {}),
            // Preserve inherited coveredBy if the explicit group has no examples (delegation)
            ...(!group.examples?.length && inherited[key]?.coveredBy && !group.coveredBy
                ? { coveredBy: inherited[key].coveredBy }
                : {}),
        }
    }

    const shouldSucceedWith: Record<string, SerializedSuccessGroup> = {}
    for (const [key, group] of Object.entries(spec.shouldSucceedWith || {}) as any[]) {
        if (!group) continue
        shouldSucceedWith[key] = {
            description: group.description || '',
            exampleCount: group.examples?.length || 0,
            examples: (group.examples || []).map((e: any) => ({
                description: e.description || '',
                ...(e.whenInput !== undefined ? { whenInput: safeSerialize(e.whenInput) } : {}),
                ...(e.then !== undefined ? { then: safeSerialize(e.then) } : {}),
            })),
        }
    }

    const shouldAssert: Record<string, Record<string, { description: string }>> = {}
    for (const [successType, group] of Object.entries(spec.shouldAssert || {}) as any[]) {
        shouldAssert[successType] = {}
        if (group) {
            for (const [name, assertion] of Object.entries(group) as any[]) {
                shouldAssert[successType][name] = {
                    description: assertion?.description || '',
                }
            }
        }
    }

    const steps: SerializedStep[] | undefined = spec.steps?.map((step: any) => ({
        name: step.name,
        type: step.type,
        description: step.description,
        ...(step.type === 'strategy' && step.handlers
            ? { handlers: Object.keys(step.handlers) }
            : {}),
    }))

    return {
        exportName: loaded.exportName,
        filePath: loaded.filePath,
        modulePath: loaded.modulePath,
        ...(spec.document ? { document: true } : {}),
        ...(steps ? { steps } : {}),
        shouldFailWith,
        shouldSucceedWith,
        shouldAssert,
    }
}

export function serializeGraph(analysis: SpecAnalysis): SerializedGraph {
    const { graph } = analysis
    const nodes: SerializedGraphNode[] = []
    const edges: SerializedGraphEdge[] = []
    const nodeIdMap = new Map<object, string>()

    // Build stable IDs
    let counter = 0
    for (const [specObj, node] of graph.nodes) {
        const id = `n${counter++}`
        nodeIdMap.set(specObj, id)

        // Extract domain from path
        const domainMatch = node.specPath.match(/src\/domain\/([^/]+)/)
        const domain = domainMatch ? domainMatch[1] : 'other'

        nodes.push({
            id,
            name: node.name,
            specPath: node.specPath,
            domain,
            edgeCount: node.edges.length,
        })
    }

    // Build edges
    for (const [specObj, node] of graph.nodes) {
        const sourceId = nodeIdMap.get(specObj)!
        for (const edge of node.edges) {
            const targetId = edge.target ? nodeIdMap.get(edge.target.spec) ?? null : null
            edges.push({
                source: sourceId,
                target: targetId,
                stepName: edge.stepName,
                type: edge.type,
            })
        }
    }

    return { nodes, edges }
}
