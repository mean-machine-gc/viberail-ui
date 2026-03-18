import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { viberailApi } from './src/vite-plugin-viberail-api.js'

const folder = process.env.VIBEGUARD_FOLDER || process.cwd()

export default defineConfig({
    plugins: [
        react(),
        viberailApi({ folder: resolve(folder) }),
    ],
    root: 'src/web',
    build: {
        outDir: resolve(__dirname, 'dist/web'),
        emptyOutDir: true,
    },
    server: {
        fs: {
            allow: ['../..'],  // allow reading from parent dirs (viberail, target project)
        },
    },
})
