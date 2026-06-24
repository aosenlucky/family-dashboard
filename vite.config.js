import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import travelPlanHandler from './api/travel-plan.js'
import travelPlanStreamHandler from './api/travel-plan-stream.js'
import travelHistoryHandler from './api/travel-history.js'

function localApiPlugin() {
  return {
    name: 'local-family-api',
    configureServer(server) {
      const mountApi = (path, handler) => {
        server.middlewares.use(path, async (req, res) => {
          let rawBody = ''
          req.on('data', (chunk) => { rawBody += chunk })
          req.on('end', async () => {
            let ended = false
            try {
              const mockReq = {
                method: req.method,
                headers: req.headers,
                url: req.url,
                query: Object.fromEntries(new URL(req.url || '', 'http://local').searchParams.entries()),
                body: rawBody ? JSON.parse(rawBody) : {}
              }
              const mockRes = {
                statusCode: 200,
                setHeader(name, value) {
                  res.setHeader(name, value)
                },
                flushHeaders() {
                  res.flushHeaders?.()
                },
                write(payload) {
                  res.write(payload)
                },
                end(payload) {
                  ended = true
                  res.end(payload)
                },
                status(code) {
                  this.statusCode = code
                  return this
                },
                json(payload) {
                  res.statusCode = this.statusCode
                  res.setHeader('Content-Type', 'application/json; charset=utf-8')
                  ended = true
                  res.end(JSON.stringify(payload))
                }
              }
              await handler(mockReq, mockRes)
              if (!ended && !res.writableEnded) res.end()
            } catch (error) {
              if (res.writableEnded) return
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
            }
          })
        })
      }

      mountApi('/api/travel-history', travelHistoryHandler)
      mountApi('/api/travel-plan-stream', travelPlanStreamHandler)
      mountApi('/api/travel-plan', travelPlanHandler)
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), localApiPlugin()],
})
