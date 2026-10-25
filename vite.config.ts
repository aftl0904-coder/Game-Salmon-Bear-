import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  appType: 'mpa',
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
          next()
        })
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/bible' || req.url === '/bible/') req.url = '/bible.html'
          next()
        })
      },
    },
  ],
})
