import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function apiDevServer(env) {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      for (const [k, v] of Object.entries(env)) {
        if (!process.env[k]) process.env[k] = v
      }
      server.middlewares.use('/api/claude', async (req, res) => {
        try {
          const mod = await server.ssrLoadModule('/api/claude.js')
          let body = ''
          for await (const chunk of req) body += chunk
          const parsedBody = body ? JSON.parse(body) : {}
          const vercelReq = { method: req.method, body: parsedBody, headers: req.headers }
          const vercelRes = {
            _status: 200,
            setHeader: (k, v) => res.setHeader(k, v),
            status(code) { this._status = code; return this },
            json(obj) {
              res.statusCode = this._status
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(obj))
              return this
            },
            end() { res.statusCode = this._status; res.end(); return this },
          }
          await mod.default(vercelReq, vercelRes)
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: String(err?.message || err) }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), apiDevServer(env)],
  }
})
