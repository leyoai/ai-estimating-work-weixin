#!/usr/bin/env bash
set -euo pipefail
portal_environment="${1:?Specify test or prod}"
case "$portal_environment" in
  test) portal_host="${DEPLOY_HOST:-39.108.188.240}"; build_command=build:test; portal_site=ai-estimating-work-weixin ;;
  prod) portal_host="${DEPLOY_HOST:?Set the production DEPLOY_HOST explicitly}"; build_command=build; portal_site=aeww ;;
  *) exit 2 ;;
esac
portal_user="${DEPLOY_USER:-root}"
portal_port="${DEPLOY_PORT:-22}"
[[ "$portal_host" =~ ^[a-zA-Z0-9.-]+$ && "$portal_user" =~ ^[a-zA-Z0-9_-]+$ && "$portal_port" =~ ^[0-9]+$ ]] || exit 2
portal_root="$(cd "$(dirname "$0")/.." && pwd)"
portal_stamp="$(date +%Y%m%d%H%M%S)"
portal_archive="$(mktemp -t consult-portal.XXXXXX)"
trap 'rm -f "$portal_archive"' EXIT
cd "$portal_root"
pnpm install --frozen-lockfile
pnpm "$build_command"
COPYFILE_DISABLE=1 tar --no-xattrs -czf "$portal_archive" -C dist .
scp -P "$portal_port" "$portal_archive" "$portal_user@$portal_host:/tmp/consult-portal-$portal_environment-$portal_stamp.tgz"
ssh -p "$portal_port" "$portal_user@$portal_host" bash -s -- "$portal_stamp" "$portal_environment" "$portal_site" <<'REMOTE'
set -euo pipefail
stamp="$1"
environment="$2"
site="$3"
release="/data/web/releases/ai-estimating-work-weixin-$environment-$stamp"
target="/data/web/$site"
mkdir -p "$release" /data/web/backups
tar -xzf "/tmp/consult-portal-$environment-$stamp.tgz" -C "$release"
test -s "$release/index.html"
chmod -R a+rX "$release"
# 旧站点留作备份，发布目录不覆盖旧产物。
if [ -e "$target" ] || [ -L "$target" ]; then mv "$target" "/data/web/backups/ai-estimating-work-weixin-$environment-$stamp"; fi
ln -s "$release" "$target"
printf 'Portal published: %s\n' "$release"
REMOTE
