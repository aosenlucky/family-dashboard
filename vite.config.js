import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import travelPlanHandler from './api/travel-plan.js'

function localApiPlugin() {
  return {
    name: 'local-family-api',
    configureServer(server) {
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
