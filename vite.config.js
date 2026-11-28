import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import syncHandler from './api/sync.js'
import wealthAuthHandler from './api/wealth-auth.js'
import dataBackupHandler from './api/data-backup.js'
import bookSummaryHandler from './api/book-summary.js'
import couponMediaHandler from './api/coupon-media.js'
import couponRecognizeHandler from './api/coupon-recognize.js'
import foodRecognizeHandler from './api/food-recognize.js'
import couponRemindersHandler from './api/coupon-reminders.js'
import couponReminderRunHandler from './api/coupon-reminder-run.js'
import {personalPreviewPlugin} from './server/personal-preview.js'
import diarySync from './server/diary-sync.js'
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
          let bodyBytes = 0, oversized = false
          req.on('data', (chunk) => {
            bodyBytes += chunk.length
            if (bodyBytes > (path === '/api/coupon-media' ? 6 : 32) * 1024 * 1024) {
              if (!oversized) { oversized = true; res.statusCode = 413; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: '上传内容过大。' })) }
            } else if (!oversized) rawBody += chunk
          })
          req.on('end', async () => {
            if (oversized) return
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
                  res.statusCode = this.statusCode
                  res.write(payload)
                },
                end(payload) {
                  ended = true
                  res.statusCode = this.statusCode
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
              res.statusCode = error instanceof SyntaxError ? 400 : error.status || 500
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
            }
          })
        })
      }

      mountApi('/api/sync', syncHandler)
      mountApi('/api/wealth-auth', wealthAuthHandler)
      mountApi('/api/data-backup', dataBackupHandler)
      mountApi('/api/book-summary', bookSummaryHandler)
      mountApi('/api/coupon-media', couponMediaHandler)
      mountApi('/api/coupon-recognize', couponRecognizeHandler)
      mountApi('/api/food-recognize', foodRecognizeHandler)
      mountApi('/api/coupon-reminders', couponRemindersHandler)
      mountApi('/api/coupon-reminder-run', couponReminderRunHandler)
      mountApi('/api/diary-sync', diarySync)
      mountApi('/api/travel-history', travelHistoryHandler)
      mountApi('/api/travel-plan-stream', travelPlanStreamHandler)
      mountApi('/api/travel-plan', travelPlanHandler)
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  envDir: process.env.PERSONAL_PREVIEW_DIR ? false : undefined,
  plugins: [vue(), personalPreviewPlugin(), localApiPlugin()],
})
