// Standalone script to load and serialize specs from a directory
// Used by the git diff feature to load specs from a worktree
// Usage: tsx src/diff-loader.ts <folder>

import { loadSpecs, inheritFromSteps } from 'viberail'

const folder = process.argv[2]
if (!folder) {
    process.stderr.write('Usage: tsx diff-loader.ts <folder>')
    process.exit(1)
}

const analysis = await loadSpecs({ cwd: folder })

const specs = analysis.specs.map(s => {
    const spec = s.spec as any
    const inherited: Record<string, any> = spec.steps ? inheritFromSteps(spec.steps) : {}

    const shouldFailWith: Record<string, any> = {}
    for (const [k, g] of Object.entries(inherited) as any[]) {
        shouldFailWith[k] = {
            description: g.description || '',
            coveredBy: g.coveredBy,
            exampleCount: g.examples?.length || 0,
        }
    }
    for (const [k, g] of Object.entries(spec.shouldFailWith || {}) as any[]) {
        if (!g) continue
        shouldFailWith[k] = {
            description: g.description || '',
            exampleCount: g.examples?.length || 0,
            ...(g.coveredBy ? { coveredBy: g.coveredBy } : {}),
            ...(!g.examples?.length && inherited[k]?.coveredBy && !g.coveredBy
                ? { coveredBy: inherited[k].coveredBy }
                : {}),
        }
    }

    const shouldSucceedWith: Record<string, any> = {}
    for (const [k, g] of Object.entries(spec.shouldSucceedWith || {}) as any[]) {
        if (!g) continue
        shouldSucceedWith[k] = {
            description: g.description || '',
            exampleCount: g.examples?.length || 0,
        }
    }

    const shouldAssert: Record<string, any> = {}
    for (const [st, group] of Object.entries(spec.shouldAssert || {}) as any[]) {
        shouldAssert[st] = {}
        if (group) {
            for (const [n, a] of Object.entries(group) as any[]) {
                shouldAssert[st][n] = { description: a?.description || '' }
            }
        }
    }

    const steps = spec.steps?.map((st: any) => ({
        name: st.name,
        type: st.type,
        description: st.description,
    }))

    return {
        exportName: s.exportName,
        modulePath: s.modulePath,
        shouldFailWith,
        shouldSucceedWith,
        shouldAssert,
        ...(steps ? { steps } : {}),
    }
})

process.stdout.write(JSON.stringify(specs))
