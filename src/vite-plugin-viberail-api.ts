import type { Plugin, ViteDevServer } from 'vite'
import type { SpecAnalysis, LoadedSpec } from 'viberail'
import { analyzeSpecs } from 'viberail'
import { globSync } from 'glob'
import { resolve, basename, join } from 'path'
import { readFileSync, existsSync, symlinkSync, rmSync, watch } from 'fs'
import { execSync } from 'child_process'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import type { SerializedSpec } from './server/serialize.js'

const __filename = fileURLToPath(import.meta.url)
const __pluginDir = dirname(__filename)
import { serializeSpec, serializeGraph } from './server/serialize.js'

type AnyFn = { input: any; output: any; failures: string; successTypes: string; signature: any; asyncSignature: any; depSignature: any; result: any }

type DependencyGraph = SpecAnalysis['graph']

function isSpec(value: unknown): boolean {
    return (
        value !== null &&
        typeof value === 'object' &&
        'shouldSucceedWith' in value &&
        'shouldAssert' in value
    )
}

async function loadSpecsViaVite(server: ViteDevServer, folder: string): Promise<SpecAnalysis> {
    const specGlob = 'src/domain/**/*.spec.ts'
    const specFiles = globSync(specGlob, { cwd: folder })

    if (specFiles.length === 0) {
        return { specs: [], graph: { nodes: new Map() } }
    }

    const graph: DependencyGraph = { nodes: new Map() }
    const specs: LoadedSpec[] = []

    for (const file of specFiles) {
        const resolvedPath = resolve(folder, file)
        const mod = await server.ssrLoadModule(resolvedPath)

        const mdPath = resolvedPath.replace(/\.spec\.ts$/, '.spec.md')
        const name = basename(file, '.spec.ts')

        for (const [exportName, value] of Object.entries(mod)) {
            if (isSpec(value)) {
                const node = {
                    name,
                    specPath: mdPath,
                    spec: value as object,
                    edges: [] as any[],
                }
                graph.nodes.set(value as object, node)
                specs.push({
                    exportName,
                    spec: value as any,
                    filePath: resolvedPath,
                    modulePath: file,
                })
            }
        }
    }

    // Resolve edges
    for (const node of graph.nodes.values()) {
        const spec = node.spec as any
        if (!spec.steps) continue

        for (const step of spec.steps) {
            const edge = {
                stepName: step.name,
                type: step.type,
                target: null as any,
            }

            if ((step.type === 'step' || step.type === 'safe-dep') && step.spec) {
                edge.target = graph.nodes.get(step.spec) ?? null
            }

            node.edges.push(edge)
        }
    }

    return { specs, graph }
}

export function viberailApi(opts: { folder: string }): Plugin {
    let analysis: SpecAnalysis

    return {
        name: 'viberail-api',

        async configureServer(server) {
            console.log(`Loading specs from: ${opts.folder}`)
            analysis = await loadSpecsViaVite(server, opts.folder)
            console.log(`Loaded ${analysis.specs.length} specs`)

            // Watch for .spec.ts changes and auto-reload
            const specDir = join(opts.folder, 'src/domain')
            if (existsSync(specDir)) {
                let reloadTimer: ReturnType<typeof setTimeout> | null = null
                watch(specDir, { recursive: true }, (_event, filename) => {
                    if (!filename || !filename.endsWith('.spec.ts')) return
                    if (reloadTimer) clearTimeout(reloadTimer)
                    reloadTimer = setTimeout(async () => {
                        reloadTimer = null
                        console.log(`Spec changed: ${filename} — reloading…`)
                        server.moduleGraph.invalidateAll()
                        analysis = await loadSpecsViaVite(server, opts.folder)
                        console.log(`Reloaded ${analysis.specs.length} specs`)
                        server.ws.send({ type: 'custom', event: 'viberail:specs-updated' })
                    }, 300)
                })
            }

            server.middlewares.use('/api/specs', (_req, res) => {
                const specs = analysis.specs.map(serializeSpec)
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ specs, count: specs.length }))
            })

            server.middlewares.use('/api/graph', (_req, res) => {
                const graph = serializeGraph(analysis)
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(graph))
            })

            server.middlewares.use('/api/analysis', (_req, res) => {
                const result = analyzeSpecs(analysis)
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(result))
            })

            server.middlewares.use('/api/reload', async (_req, res) => {
                // Invalidate cached modules so we get fresh specs
                server.moduleGraph.invalidateAll()
                analysis = await loadSpecsViaVite(server, opts.folder)
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ specs: analysis.specs.length, reloaded: true }))
            })

            server.middlewares.use('/api/test-results', (_req, res) => {
                const resultsPath = resolve(opts.folder, 'viberail-results.json')
                res.setHeader('Content-Type', 'application/json')
                if (!existsSync(resultsPath)) {
                    res.end(JSON.stringify({ error: 'No test results found. Run: jest --reporters=viberail/dist/reporters/json-reporter.js' }))
                    return
                }
                const data = readFileSync(resultsPath, 'utf-8')
                res.end(data)
            })

            // Git diff endpoints
            server.middlewares.use('/api/git/refs', (_req, res) => {
                res.setHeader('Content-Type', 'application/json')
                try {
                    const branches = execSync('git branch -a --format="%(refname:short)"', { cwd: opts.folder })
                        .toString().trim().split('\n').filter(Boolean)
                    const commits = execSync('git log --oneline -30', { cwd: opts.folder })
                        .toString().trim().split('\n').map(line => {
                            const [hash, ...rest] = line.split(' ')
                            return { hash, message: rest.join(' ') }
                        })
                    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: opts.folder })
                        .toString().trim()
                    res.end(JSON.stringify({ branches, commits, currentBranch }))
                } catch (err: any) {
                    res.statusCode = 500
                    res.end(JSON.stringify({ error: err.message }))
                }
            })

            server.middlewares.use('/api/git/diff/', (req, res) => {
                const ref = decodeURIComponent(req.url?.replace(/^\//, '') || '')
                res.setHeader('Content-Type', 'application/json')
                if (!ref) {
                    res.statusCode = 400
                    res.end(JSON.stringify({ error: 'ref parameter required' }))
                    return
                }

                try {
                    // Current specs (already loaded)
                    const currentSpecs = analysis.specs.map(serializeSpec)

                    // Load specs from target ref via git worktree + tsx
                    const worktreeDir = resolve(tmpdir(), `viberail-diff-${Date.now()}`)
                    try {
                        execSync(`git worktree add "${worktreeDir}" "${ref}" --detach`, { cwd: opts.folder, stdio: 'pipe' })

                        // Symlink node_modules so imports resolve
                        const nodeModules = resolve(opts.folder, 'node_modules')
                        if (existsSync(nodeModules)) {
                            symlinkSync(nodeModules, resolve(worktreeDir, 'node_modules'))
                        }

                        // Load specs from worktree via tsx child process
                        const loaderScript = resolve(__pluginDir, 'diff-loader.ts')
                        const refSpecs = JSON.parse(
                            execSync(`npx tsx "${loaderScript}" "${worktreeDir}"`, {
                                cwd: worktreeDir,
                                timeout: 30000,
                                stdio: ['pipe', 'pipe', 'pipe'],
                                env: { ...process.env, NODE_PATH: resolve(opts.folder, 'node_modules') },
                            }).toString()
                        ) as SerializedSpec[]

                        // Compute diff
                        const diff = computeSpecDiff(refSpecs, currentSpecs)
                        res.end(JSON.stringify({ ref, diff }))
                    } finally {
                        // Clean up worktree
                        try {
                            execSync(`git worktree remove "${worktreeDir}" --force`, { cwd: opts.folder, stdio: 'pipe' })
                        } catch {
                            rmSync(worktreeDir, { recursive: true, force: true })
                            try { execSync(`git worktree prune`, { cwd: opts.folder, stdio: 'pipe' }) } catch {}
                        }
                    }
                } catch (err: any) {
                    res.statusCode = 500
                    res.end(JSON.stringify({ error: err.message }))
                }
            })

            server.middlewares.use('/api/spec/', (req, res) => {
                const name = req.url?.replace(/^\//, '') || ''
                const loaded = analysis.specs.find(s => s.exportName === name)
                if (!loaded) {
                    res.statusCode = 404
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify({ error: `Spec '${name}' not found` }))
                    return
                }
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(serializeSpec(loaded)))
            })
        },
    }
}

// --- Spec diff computation ---

export type SpecDiff = {
    added: SerializedSpec[]
    removed: PartialSpec[]
    changed: SpecChange[]
    unchanged: number
}

type PartialSpec = { exportName: string; modulePath?: string }

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

function computeSpecDiff(oldSpecs: SerializedSpec[], newSpecs: SerializedSpec[]): SpecDiff {
    const oldMap = new Map(oldSpecs.map(s => [s.exportName, s]))
    const newMap = new Map(newSpecs.map(s => [s.exportName, s]))

    const added: SerializedSpec[] = []
    const removed: PartialSpec[] = []
    const changed: SpecChange[] = []
    let unchanged = 0

    // Find added and changed
    for (const [name, newSpec] of newMap) {
        const oldSpec = oldMap.get(name)
        if (!oldSpec) {
            added.push(newSpec)
            continue
        }

        const change = diffSpec(oldSpec, newSpec)
        if (change) {
            changed.push(change)
        } else {
            unchanged++
        }
    }

    // Find removed
    for (const [name, oldSpec] of oldMap) {
        if (!newMap.has(name)) {
            removed.push({ exportName: oldSpec.exportName, modulePath: oldSpec.modulePath })
        }
    }

    return { added, removed, changed, unchanged }
}

function diffSpec(old: SerializedSpec, cur: SerializedSpec): SpecChange | null {
    const oldFails = new Set(Object.keys(old.shouldFailWith || {}))
    const curFails = new Set(Object.keys(cur.shouldFailWith || {}))
    const oldSuccesses = new Set(Object.keys(old.shouldSucceedWith || {}))
    const curSuccesses = new Set(Object.keys(cur.shouldSucceedWith || {}))

    const failuresAdded = [...curFails].filter(k => !oldFails.has(k))
    const failuresRemoved = [...oldFails].filter(k => !curFails.has(k))
    const successesAdded = [...curSuccesses].filter(k => !oldSuccesses.has(k))
    const successesRemoved = [...oldSuccesses].filter(k => !curSuccesses.has(k))

    // Assertions diff
    const oldAssertions = new Set<string>()
    const curAssertions = new Set<string>()
    for (const [st, group] of Object.entries(old.shouldAssert || {})) {
        for (const name of Object.keys(group)) oldAssertions.add(`${st}.${name}`)
    }
    for (const [st, group] of Object.entries(cur.shouldAssert || {})) {
        for (const name of Object.keys(group)) curAssertions.add(`${st}.${name}`)
    }
    const assertionsAdded = [...curAssertions].filter(k => !oldAssertions.has(k))
    const assertionsRemoved = [...oldAssertions].filter(k => !curAssertions.has(k))

    // Steps diff
    const oldSteps = (old.steps || []).map(s => s.name)
    const curSteps = (cur.steps || []).map(s => s.name)
    const stepsAdded = curSteps.filter(s => !oldSteps.includes(s))
    const stepsRemoved = oldSteps.filter(s => !curSteps.includes(s))

    // Example count changes
    const exampleCountChanges: Array<{ group: string; from: number; to: number }> = []
    for (const key of [...curFails].filter(k => oldFails.has(k))) {
        const oldCount = (old.shouldFailWith as any)[key]?.exampleCount || 0
        const curCount = (cur.shouldFailWith as any)[key]?.exampleCount || 0
        if (oldCount !== curCount) exampleCountChanges.push({ group: key, from: oldCount, to: curCount })
    }
    for (const key of [...curSuccesses].filter(k => oldSuccesses.has(k))) {
        const oldCount = (old.shouldSucceedWith as any)[key]?.exampleCount || 0
        const curCount = (cur.shouldSucceedWith as any)[key]?.exampleCount || 0
        if (oldCount !== curCount) exampleCountChanges.push({ group: key, from: oldCount, to: curCount })
    }

    const hasChanges = failuresAdded.length + failuresRemoved.length +
        successesAdded.length + successesRemoved.length +
        assertionsAdded.length + assertionsRemoved.length +
        stepsAdded.length + stepsRemoved.length +
        exampleCountChanges.length > 0

    if (!hasChanges) return null

    return {
        exportName: cur.exportName,
        modulePath: cur.modulePath || old.modulePath || '',
        failuresAdded, failuresRemoved,
        successesAdded, successesRemoved,
        assertionsAdded, assertionsRemoved,
        stepsAdded, stepsRemoved,
        exampleCountChanges,
    }
}
