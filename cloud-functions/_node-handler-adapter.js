function lowerCaseHeaders(headers) {
  const result = {}
  for (const [key, value] of headers.entries()) result[key.toLowerCase()] = value
  return result
}

async function parseRequestBody(request) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return {}
  const contentType = request.headers.get('content-type') || ''
  const text = await request.text()
  if (!text) return {}
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text)
    } catch {
      return {}
    }
  }
  return text
}

function createNodeRequest(request, body) {
  const url = new URL(request.url)
  return {
    method: request.method,
    headers: lowerCaseHeaders(request.headers),
    url: `${url.pathname}${url.search}`,
    query: Object.fromEntries(url.searchParams.entries()),
    body
  }
}

function createBufferedResponse() {
  const headers = new Headers()
  let statusCode = 200
  let ended = false
  const chunks = []
  return {
    response: {
      get statusCode() {
        return statusCode
      },
      set statusCode(value) {
        statusCode = value
      },
      setHeader(name, value) {
        headers.set(name, value)
      },
      flushHeaders() {},
      status(code) {
        statusCode = code
        return this
      },
      json(payload) {
        headers.set('content-type', 'application/json; charset=utf-8')
        chunks.push(JSON.stringify(payload))
        ended = true
        return this
      },
      write(payload) {
        chunks.push(payload)
      },
      end(payload = '') {
        if (payload) chunks.push(payload)
        ended = true
      }
    },
    toResponse() {
      return new Response(chunks.join(''), { status: statusCode, headers })
    },
    get ended() {
      return ended
    }
  }
}

export async function runNodeHandler(handler, context) {
  const request = context.request || context
  const body = await parseRequestBody(request)
  const mockReq = createNodeRequest(request, body)
  const mockRes = createBufferedResponse()
  await handler(mockReq, mockRes.response)
  if (!mockRes.ended) mockRes.response.end()
  return mockRes.toResponse()
}

export async function runNodeStreamHandler(handler, context) {
  const request = context.request || context
  const body = await parseRequestBody(request)
  const mockReq = createNodeRequest(request, body)
  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()
  const pendingWrites = []
  const headers = new Headers({
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no'
  })

  const mockRes = {
    statusCode: 200,
    setHeader(name, value) {
      headers.set(name, value)
    },
    flushHeaders() {},
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.write(JSON.stringify(payload))
      this.end()
      return this
    },
    write(payload) {
      pendingWrites.push(writer.write(encoder.encode(String(payload))))
    },
    async end(payload = '') {
      if (payload) this.write(payload)
      await Promise.all(pendingWrites)
      await writer.close()
    }
  }

  handler(mockReq, mockRes).catch(async (error) => {
    const detail = error instanceof Error ? error.message : String(error)
    pendingWrites.push(writer.write(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Function failed', detail })}\n\n`)))
    await Promise.all(pendingWrites)
    await writer.close()
  })

  return new Response(stream.readable, { status: 200, headers })
}
