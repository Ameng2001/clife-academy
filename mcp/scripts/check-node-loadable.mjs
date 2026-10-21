#!/usr/bin/env node
/* 桥在裸 node 下跑，不走 Vite。课程包 frontend/src/lib/lessons.js 要是哪天引了 Vite 才认的东西（import.meta.glob、?raw、.jsx），
 * vitest 全绿，桥却起不来。这个脚本就是在 vitest 之外用裸 node 把入口 import 一遍。 */
try {
  await import('../src/tools.js')
  console.log('ok: mcp/src/tools.js loads under plain node')
} catch (e) {
  console.error('mcp import graph does not load under plain node:', e.message)
  process.exit(1)
}
