#!/usr/bin/env node
/**
 * Host-side proxy for Docker dev: forwards requests to local Designer.
 * Run on the host: node scripts/designer-proxy.js
 * The container's Vite proxy targets host.docker.internal:18080.
 * This proxy forwards to 127.0.0.1:80 so Designer (bound to localhost) is reachable.
 */
import http from 'node:http'
import httpProxy from 'http-proxy'

const LISTEN_PORT = parseInt(process.env.DESIGNER_PROXY_PORT || '18080', 10)
const TARGET = process.env.DESIGNER_PROXY_TARGET || 'http://127.0.0.1:80'

const proxy = httpProxy.createProxyServer({ ws: true })

const server = http.createServer((req, res) => {
  proxy.web(req, res, { target: TARGET })
})

server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head, { target: TARGET.replace(/^http/, 'ws') })
})

proxy.on('error', (err, req, res) => {
  console.error('[designer-proxy]', err.message)
  if (res && !res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' }).end('Proxy error')
})

server.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log(`[designer-proxy] Listening on 0.0.0.0:${LISTEN_PORT} -> ${TARGET}`)
  console.log(`[designer-proxy] Set VITE_PROXY_TARGET=http://host.docker.internal:${LISTEN_PORT} in docker-compose`)
})
