import { defineConfig } from 'vite'
import path from 'node:path'

const buildSha = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || 'local'

export default defineConfig({
  appType: 'mpa',
  // Build stamp (Alan): time + short SHA for loading / title corners.
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __BUILD_SHA__: JSON.stringify(buildSha),
  },
  server: {
    host: '0.0.0.0',
    port: 4521,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4521,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        bible: path.resolve(__dirname, 'bible.html'),
      },
    },
  },
  plugins: [
    {
      name: 'bible-pretty-url',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/bible' || req.url === '/bible/') req.url = '/bible.html'
          if (req.url === '/guide' || req.url === '/guide/') req.url = '/guide/index.html'
          if (req.url === '/gallery' || req.url === '/gallery/') req.url = '/gallery/index.html'
          if (req.url === '/sticker' || req.url === '/sticker/') req.url = '/sticker/index.html'
          next()
        })
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/bible' || req.url === '/bible/') req.url = '/bible.html'
          if (req.url === '/guide' || req.url === '/guide/') req.url = '/guide/index.html'
          if (req.url === '/gallery' || req.url === '/gallery/') req.url = '/gallery/index.html'
          if (req.url === '/sticker' || req.url === '/sticker/') req.url = '/sticker/index.html'
          next()
        })
      },
    },
  ],
})
