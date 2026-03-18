#!/usr/bin/env node

import { resolve } from 'path'
import { existsSync } from 'fs'
import { createServer } from 'vite'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const args = process.argv.slice(2)
let folder = process.cwd()
let port = 3700

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--folder' && args[i + 1]) {
        folder = resolve(args[i + 1])
        i++
    } else if (args[i] === '--port' && args[i + 1]) {
        port = parseInt(args[i + 1], 10)
        i++
    } else if (args[i] === '--help' || args[i] === '-h') {
        console.log(`viberail-ui — interactive visual workbench for viberail specifications

Usage:
  viberail-ui --folder <project-path> [--port <port>]

Options:
  --folder  Path to a project with .spec.ts files (default: cwd)
  --port    Server port (default: 3700)
`)
        process.exit(0)
    }
}

if (!existsSync(folder)) {
    console.error(`Folder not found: ${folder}`)
    process.exit(1)
}

process.env.VIBEGUARD_FOLDER = folder

const projectRoot = resolve(__dirname, '..')

const server = await createServer({
    configFile: resolve(projectRoot, 'vite.config.ts'),
    server: { port },
})

await server.listen()
server.printUrls()
