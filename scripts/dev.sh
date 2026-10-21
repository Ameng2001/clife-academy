#!/bin/sh
# 本地开发：api（:3000，数据在 ./data）＋ 前端 vite（:5173，/api 反代到 api）。Ctrl-C 一起停。
cd "$(dirname "$0")/.." || exit 1
mkdir -p data
( cd api && DATA_DIR=../data PORT=3000 ALLOW_GUEST=1 DEV_LOGIN=1 node server.js ) &
API=$!
trap 'kill $API 2>/dev/null' EXIT INT TERM
cd frontend && exec npx vite --host 127.0.0.1 --port 5173 --strictPort
