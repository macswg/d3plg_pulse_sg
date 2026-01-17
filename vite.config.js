import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { designerPythonLoader } from '@disguise-one/designer-pythonapi/vite-loader'
import { existsSync, mkdirSync, readFileSync, copyFileSync } from 'node:fs'
import path from 'node:path'

const BUILD_TARGET_FILE = process.env.BUILD_TARGET_FILE ?? '.build-target'
const BUILD_TARGET_LOCAL_FILE = '.build-target.local'
const FALLBACK_OUT_DIR = 'dist'

function resolveBuildOutputDir() {
  const configuredPath = (() => {
    // Check for local override first, then fall back to default
    const candidates = [
      path.resolve(process.cwd(), BUILD_TARGET_LOCAL_FILE),
      path.resolve(process.cwd(), BUILD_TARGET_FILE)
    ]

    for (const candidate of candidates) {
      if (!existsSync(candidate)) {
        continue
      }

      const contents = readFileSync(candidate, 'utf-8').trim()
      if (!contents) {
        continue
      }

      console.log(`[vite.config.js] Using build target from: ${candidate}`)
      return path.isAbsolute(contents)
        ? contents
        : path.resolve(process.cwd(), contents)
    }

    return null
  })()

  const outDir = configuredPath ?? path.resolve(process.cwd(), FALLBACK_OUT_DIR)

  try {
    mkdirSync(outDir, { recursive: true })
  } catch (err) {
    console.warn(
      `[vite.config.js] Failed to ensure build output directory "${outDir}". Falling back to "${FALLBACK_OUT_DIR}".`,
      err
    )
    return path.resolve(process.cwd(), FALLBACK_OUT_DIR)
  }

  return outDir
}

const buildOutDir = resolveBuildOutputDir()
const isDocker = process.env.DOCKER === 'true'

// Custom plugin to copy d3plugin.json after build
function copyPluginAssets() {
  return {
    name: 'copy-plugin-assets',
    closeBundle() {
      // Copy d3plugin.json to build output
      const srcPlugin = path.resolve(process.cwd(), 'public/d3plugin.json')
      const destPlugin = path.resolve(buildOutDir, 'd3plugin.json')
      
      if (existsSync(srcPlugin)) {
        try {
          copyFileSync(srcPlugin, destPlugin)
          console.log('[copy-plugin-assets] Copied d3plugin.json to', destPlugin)
        } catch (err) {
          console.warn('[copy-plugin-assets] Failed to copy d3plugin.json:', err)
        }
      }
      
      // Copy icon.svg to build output
      const srcIcon = path.resolve(process.cwd(), 'public/icon.svg')
      const destIcon = path.resolve(buildOutDir, 'icon.svg')
      
      if (existsSync(srcIcon)) {
        try {
          copyFileSync(srcIcon, destIcon)
          console.log('[copy-plugin-assets] Copied icon.svg to', destIcon)
        } catch (err) {
          console.warn('[copy-plugin-assets] Failed to copy icon.svg:', err)
        }
      }
    }
  }
}

export default defineConfig({
  plugins: [
    vue(),
    designerPythonLoader(),
    copyPluginAssets()
  ],
  server: {
    port: 5173,
    host: '0.0.0.0', // Allow external connections (needed for Docker)
    watch: {
      // Use polling in Docker (especially needed on Windows), native watching otherwise
      usePolling: isDocker,
      interval: isDocker ? 1000 : undefined, // Polling interval only when polling is enabled
    },
    hmr: {
      port: 5173,
      host: 'localhost', // HMR host - browser connects to localhost
      clientPort: 5173, // Port the client connects to
    },
  },
  build: {
    outDir: buildOutDir,
    emptyOutDir: false,
  },
})
