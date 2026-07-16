import type { Plugin } from 'vite'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

import vueDevTools from 'vite-plugin-vue-devtools'

const require = createRequire(import.meta.url)
const fs = require('node:fs')
const archiver = require('archiver')

interface ThemeManifest {
  preview?: unknown
  version?: unknown
}

const nodegetThemeJsonPath = resolve(__dirname, 'nodeget-theme.json')
const devApiTarget = process.env.VITE_API_TARGET || 'http://127.0.0.1:25774'

function readThemeManifest(): ThemeManifest {
  if (!existsSync(nodegetThemeJsonPath))
    throw new Error('nodeget-theme.json not found')

  return JSON.parse(readFileSync(nodegetThemeJsonPath, 'utf-8')) as ThemeManifest
}

function getThemeVersion(): string {
  const version = readThemeManifest().version

  if (typeof version !== 'string' || !version.trim())
    throw new TypeError('nodeget-theme.json does not contain a top-level string version field')

  return version.trim()
}

function getCommitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  }
  catch {
    return 'unknown'
  }
}

function getDistFiles(dir: string, baseDir = dir): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry: { name: string, isDirectory: () => boolean }) => {
    const fullPath = resolve(dir, entry.name)
    if (entry.isDirectory())
      return getDistFiles(fullPath, baseDir)
    return [fullPath.slice(baseDir.length + 1).replaceAll('\\\\', '/')]
  }).sort()
}

function writeThemeFilesManifest(distDir: string): string {
  const files = getDistFiles(distDir).map(file => `dist/${file}`)
  const manifestPath = resolve(__dirname, 'nodeget-theme-files.json')
  writeFileSync(manifestPath, `${JSON.stringify(files, null, 2)}\n`)
  return manifestPath
}

/**
 * NodeGet theme zip
 * ├── nodeget-theme.json
 * ├── nodeget-theme-files.json
 * ├── preview.png
 * └── dist/
 */
function nodegetThemeZip(): Plugin {
  return {
    name: 'nodeget-theme-zip',
    apply: 'build',
    closeBundle: async () => {
      const commitHash = getCommitHash()
      const zipFileName = `nodeget-theme-Glassmorphism-build-${commitHash}.zip`
      const distDir = resolve(__dirname, 'dist')
      const previewPath = resolve(__dirname, 'docs/preview.png')
      const outputPath = resolve(__dirname, zipFileName)
      const themeManifest = readThemeManifest()
      const manifestPreviewName = typeof themeManifest.preview === 'string' && themeManifest.preview.trim()
        ? themeManifest.preview.trim()
        : 'preview.png'

      if (!existsSync(distDir)) {
        console.log('[nodeget-theme-zip] dist directory not found, skipping zip creation')
        return
      }

      const themeFilesPath = writeThemeFilesManifest(distDir)
      const output = fs.createWriteStream(outputPath)
      const archive = archiver('zip', { zlib: { level: 9 } })

      return new Promise((resolve, reject) => {
        output.on('close', () => {
          const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2)
          console.log(`[nodeget-theme-zip] Created ${zipFileName} (${sizeMB} MB)`)
          resolve(undefined)
        })

        archive.on('error', (err: Error) => {
          console.error('[nodeget-theme-zip] Error:', err)
          reject(err)
        })

        archive.pipe(output)
        archive.file(nodegetThemeJsonPath, { name: 'nodeget-theme.json' })
        archive.file(themeFilesPath, { name: 'nodeget-theme-files.json' })

        if (existsSync(previewPath)) {
          archive.file(previewPath, { name: 'preview.png' })
          if (manifestPreviewName !== 'preview.png')
            archive.file(previewPath, { name: manifestPreviewName })
        }

        archive.directory(distDir, 'dist')
        archive.finalize()
      })
    },
  }
}

export default defineConfig({
  define: {
    __BUILD_VERSION__: JSON.stringify(getThemeVersion()),
    __BUILD_GIT_HASH__: JSON.stringify(getCommitHash()),
  },
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
    nodegetThemeZip(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: devApiTarget,
        changeOrigin: true,
        headers: { Origin: devApiTarget },
        rewriteWsOrigin: true,
        ws: true,
      },
      '/themes': {
        target: devApiTarget,
        changeOrigin: true,
        headers: { Origin: devApiTarget },
      },
    },
  },
  build: {
    target: ['es2018', 'safari15.4'],
    cssTarget: 'safari15.4',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'echarts': ['echarts', 'vue-echarts'],
          'globe': ['globe.gl', 'three'],
          'reka-ui': ['reka-ui'],
          'vueuse': ['@vueuse/core'],
          'v3-services': [
            './src/services/history.service.ts',
            './src/services/metrics.service.ts',
            './src/services/request.service.ts',
            './src/services/cache.service.ts',
            './src/utils/osImageHelper.ts',
            './src/utils/metricSeries.ts',
            './src/composables/useNodePingDisplay.ts',
          ],
        },
      },
    },
  },
})
