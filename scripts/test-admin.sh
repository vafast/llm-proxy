#!/usr/bin/env bash
# Admin 接口测试脚本
# 需先配置 .env.development: ADMIN_KEY, DATABASE_PUBLIC_URL
# Redis 测试需: REDIS_PUBLIC_URL（或 REDIS_URL）
# 启动服务: npm run dev

set -e
BASE="${1:-http://localhost:8787}"
ADMIN_KEY="${ADMIN_KEY:-}"

if [ -z "$ADMIN_KEY" ]; then
  ADMIN_KEY=$(grep '^ADMIN_KEY=' .env.development 2>/dev/null | cut -d= -f2-)
fi
if [ -z "$ADMIN_KEY" ]; then
  echo "请设置 ADMIN_KEY（.env.development 或环境变量）"
  exit 1
fi

AUTH="Authorization: Bearer $ADMIN_KEY"

echo "=== 1. GET /admin/keys ==="
curl -s -X GET "$BASE/admin/keys" -H "$AUTH" | jq .

echo ""
echo "=== 2. POST /admin/keys（创建）==="
RES=$(curl -s -X POST "$BASE/admin/keys" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"test-key"}')
echo "$RES" | jq .
KEY=$(echo "$RES" | jq -r '.key // empty')
ID=$(echo "$RES" | jq -r '.id // empty')

if [ -n "$ID" ]; then
  echo ""
  echo "=== 3. PATCH /admin/keys/$ID（禁用）==="
  curl -s -X PATCH "$BASE/admin/keys/$ID" -H "$AUTH" -H "Content-Type: application/json" -d '{"enabled":false}' | jq .

  echo ""
  echo "=== 4. PATCH /admin/keys/$ID（启用）==="
  curl -s -X PATCH "$BASE/admin/keys/$ID" -H "$AUTH" -H "Content-Type: application/json" -d '{"enabled":true}' | jq .

  echo ""
  echo "=== 5. 用创建的 key 访问 /status ==="
  curl -s -X GET "$BASE/status" -H "Authorization: Bearer $KEY" | jq .

  echo ""
  echo "=== 6. DELETE /admin/keys/$ID ==="
  curl -s -X DELETE "$BASE/admin/keys/$ID" -H "$AUTH" | jq .
fi

echo ""
echo "=== 7. GET /admin/redis-ping（Redis 轮询，两个相同 key 应返回 [0, 1]）==="
curl -s -X GET "$BASE/admin/redis-ping" -H "$AUTH" | jq .
