#!/bin/sh
# 本地启停：api（:3000，数据在 ./data）与前端 vite（:5173）后台跑，日志在 .local/。
#   sh scripts/local.sh start|stop|restart|status|log [api|web]
# 不带第二个参数就两个一起。端口被别处占着时 start 会跳过，stop 会连那个一起停（按端口找）。
# 环境变量可覆盖：PORT_API、PORT_WEB、ADMIN_UIDS、ASSISTANT_*（答疑与 Coach 的模型，见 .env.example）。
cd "$(dirname "$0")/.." || exit 1
mkdir -p data .local
PORT_API="${PORT_API:-3000}"; PORT_WEB="${PORT_WEB:-5173}"
LOG_API=.local/api.log; LOG_WEB=.local/web.log
what="${2:-all}"

pid_on() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1; }

start_api() {
  if [ -n "$(pid_on "$PORT_API")" ]; then echo "api 已在 :$PORT_API（pid $(pid_on "$PORT_API")）"; return; fi
  ( cd api && DATA_DIR=../data PORT="$PORT_API" ALLOW_GUEST=1 DEV_LOGIN=1 \
      ADMIN_UIDS="${ADMIN_UIDS:-gliDMcqPN7VJCG8e}" POINTS_PER_CREDIT="${POINTS_PER_CREDIT:-10}" \
      TOOLS_API_KEY="${TOOLS_API_KEY:-dev-tools-key}" PLATFORM_EVENTS_KEY="${PLATFORM_EVENTS_KEY:-dev-platform-key}" \
      nohup node server.js >"../$LOG_API" 2>&1 & )
  i=0; while [ $i -lt 30 ] && [ -z "$(pid_on "$PORT_API")" ]; do sleep 0.2; i=$((i+1)); done
  if [ -n "$(pid_on "$PORT_API")" ]; then echo "api 起了 :$PORT_API → http://127.0.0.1:$PORT_API/api/health"; else echo "api 没起来，看 $LOG_API"; tail -5 "$LOG_API"; fi
}
start_web() {
  if [ -n "$(pid_on "$PORT_WEB")" ]; then echo "前端已在 :$PORT_WEB（pid $(pid_on "$PORT_WEB")）"; return; fi
  ( cd frontend && nohup npx vite --host 127.0.0.1 --port "$PORT_WEB" --strictPort >"../$LOG_WEB" 2>&1 & )
  i=0; while [ $i -lt 50 ] && [ -z "$(pid_on "$PORT_WEB")" ]; do sleep 0.2; i=$((i+1)); done
  if [ -n "$(pid_on "$PORT_WEB")" ]; then echo "前端起了 → http://127.0.0.1:$PORT_WEB"; else echo "前端没起来，看 $LOG_WEB"; tail -5 "$LOG_WEB"; fi
}
stop_port() {
  p="$(pid_on "$1")"
  if [ -z "$p" ]; then echo "$2 没在跑"; return; fi
  kill "$p" 2>/dev/null; i=0; while [ $i -lt 20 ] && kill -0 "$p" 2>/dev/null; do sleep 0.2; i=$((i+1)); done
  kill -0 "$p" 2>/dev/null && kill -9 "$p" 2>/dev/null
  echo "$2 停了（pid $p）"
}
status() {
  a="$(pid_on "$PORT_API")"; w="$(pid_on "$PORT_WEB")"
  [ -n "$a" ] && echo "api   :$PORT_API  pid $a  $(curl -s "http://127.0.0.1:$PORT_API/api/health" 2>/dev/null)" || echo "api   :$PORT_API  没在跑"
  [ -n "$w" ] && echo "前端  :$PORT_WEB  pid $w  http://127.0.0.1:$PORT_WEB" || echo "前端  :$PORT_WEB  没在跑"
}

case "$1" in
  start)   [ "$what" != web ] && start_api; [ "$what" != api ] && start_web ;;
  stop)    [ "$what" != web ] && stop_port "$PORT_API" api; [ "$what" != api ] && stop_port "$PORT_WEB" 前端 ;;
  restart) [ "$what" != web ] && { stop_port "$PORT_API" api; start_api; }; [ "$what" != api ] && { stop_port "$PORT_WEB" 前端; start_web; } ;;
  status)  status ;;
  log)     if [ "$what" = web ]; then tail -f "$LOG_WEB"; else tail -f "$LOG_API"; fi ;;
  *) echo "用法：sh scripts/local.sh start|stop|restart|status|log [api|web]"; exit 2 ;;
esac
