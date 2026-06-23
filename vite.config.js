import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import travelPlanHandler from './api/travel-plan.js'
import travelHistoryHandler from './api/travel-history.js'

function localApiPlugin() {
  return {
    name: 'local-family-api',
    configureServer(server) {
      const mountJsonApi = (path, handler) => {
        server.middlewares.use(path, async (req, res) => {
          let rawBody = ''
          req.on('data', (chunk) => { rawBody += chunk })
          req.on('end', async () => {
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
                status(code) {
                  this.statusCode = code
                  return this
                },
                json(payload) {
                  res.statusCode = this.statusCode
                  res.setHeader('Content-Type', 'application/json; charset=utf-8')
                  res.end(JSON.stringify(payload))
                }
              }
              await handler(mockReq, mockRes)
            } catch (error) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
            }
          })
        })
      }

      mountJsonApi('/api/travel-history', travelHistoryHandler)
      server.middlewares.use('/api/travel-plan', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Method Not Allowed' }))
          return
        }

        let rawBody = ''
        req.on('data', (chunk) => { rawBody += chunk })
        req.on('end', async () => {
          const mockReq = {
            method: req.method,
            headers: req.headers,
            body: rawBody ? JSON.parse(rawBody) : {}
          }
          const mockRes = {
            statusCode: 200,
            status(code) {
              this.statusCode = code
              return this
            },
            json(payload) {
              res.statusCode = this.statusCode
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify(payload))
            }
          }
          await travelPlanHandler(mockReq, mockRes)
        })
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), localApiPlugin()],
})
