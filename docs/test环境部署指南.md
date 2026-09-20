# 测试环境打包与部署

## 1. 环境与前置条件

- 网站：https://test.yuecheers.com/ai-estimating-work-weixin/
- 服务器目录：`/data/web/ai-estimating-work-weixin/`；接口前缀：`/ai-estimating-work-weixin/api/`。
- 本地安装 Node.js 22.12+（或满足 Vite 8 要求的更新版本）、pnpm、SSH/SCP 和 tar；使用已配置的 SSH 密钥或 SSH 提示交互认证，不在脚本保存密码。
- 服务器已有 Nginx，以及 `test.yuecheers.com` 的 DNS 和 HTTPS 证书配置；部署账号需有 `/data/web` 和 `/tmp` 写入权限。
- 先发布兼容后端，再发布本站。后端需包含 `70c03c11` 的客户全部订单摘要功能或等价后续版本；数据库按当前服务端版本完成迁移，本文不内嵌 SQL。
- 账号须为有效 ADMIN、已绑定企微员工且拥有 `consult-staff:view` 权限。

## 2. 一键安装、打包与上传（本地电脑执行）

### 2.1 首次准备

确认本机已有 Node.js、pnpm、SSH、SCP 和 tar：

```bash
cd /Users/kuzank/Desktop/leyu/code/ai-estimating-work-weixin

node --version
pnpm --version
ssh -V
command -v scp
tar --version

# 严格按照 pnpm-lock.yaml 安装，锁文件与 package.json 不一致时直接失败
pnpm install --frozen-lockfile

# 先完成类型检查和测试环境构建，产物写入 dist/
pnpm typecheck
pnpm build:test
```

构建完成后，检查 `dist/index.html` 中的资源地址以 `/ai-estimating-work-weixin/` 开头：

```bash
grep -E '/ai-estimating-work-weixin/assets/' dist/index.html
```

### 2.2 完整一键部署脚本

下面代码可以**完整复制并直接粘贴到 Terminal 执行**，不需要先保存成文件。它会检查本地工程、确认 SSH 连接，然后调用项目正式维护的 `deploy:test` 脚本完成重新安装依赖、类型检查、构建、压缩、上传和远程版本切换：

```bash
bash <<'DEPLOY_SCRIPT'
set -euo pipefail

project_dir='/Users/kuzank/Desktop/leyu/code/ai-estimating-work-weixin'
deploy_host='39.108.188.240'
deploy_user='root'
deploy_port='22'

cd "$project_dir"

command -v node >/dev/null || { echo '未安装 Node.js'; exit 1; }
command -v pnpm >/dev/null || { echo '未安装 pnpm'; exit 1; }
command -v ssh >/dev/null || { echo '未安装 ssh'; exit 1; }
command -v scp >/dev/null || { echo '未安装 scp'; exit 1; }
command -v tar >/dev/null || { echo '未安装 tar'; exit 1; }
test -f package.json || { echo "工程目录错误：$project_dir"; exit 1; }
test -f pnpm-lock.yaml || { echo '缺少 pnpm-lock.yaml'; exit 1; }

# 确认目标服务器与 SSH 连接
ssh -p "$deploy_port" "$deploy_user@$deploy_host" \
  'hostname && test -d /data/web && test -w /data/web && test -w /tmp'

# deploy.sh 内也会重新执行锁定安装，此处提前发现依赖问题
pnpm install --frozen-lockfile

# 将参数只传给本次命令，不污染后续终端会话
DEPLOY_HOST="$deploy_host" \
DEPLOY_USER="$deploy_user" \
DEPLOY_PORT="$deploy_port" \
pnpm deploy:test

# 校验远程发布目录、软链接和测试环境资源路径
ssh -p "$deploy_port" "$deploy_user@$deploy_host" \
  "test -L /data/web/ai-estimating-work-weixin && \
   test -s /data/web/ai-estimating-work-weixin/index.html && \
   grep -q '/ai-estimating-work-weixin/assets/' \
     /data/web/ai-estimating-work-weixin/index.html && \
   readlink -f /data/web/ai-estimating-work-weixin"

# 验证公网入口，并输出最终 HTTP 状态码
http_status="$(curl --fail --silent --show-error --location \
  --output /dev/null --write-out '%{http_code}' \
  'https://test.yuecheers.com/ai-estimating-work-weixin/')"
echo "测试环境部署完成，HTTP 状态码：$http_status"
DEPLOY_SCRIPT
```

测试服务器默认是 39.108.188.240；以上命令显式列出，避免目标不清晰。

### 2.3 脚本实际执行过程

部署脚本执行 `pnpm build:test`。资源基础路径自动为 `/ai-estimating-work-weixin/`，API 默认同域 `/ai-estimating-work-weixin/api`，无需手工设置 `VITE_API_BASE`。如终端或本地环境文件设置过该变量，确认其未指向其他环境。

执行顺序如下：

1. 使用 `pnpm install --frozen-lockfile` 安装锁定版本依赖。
2. 运行 `vue-tsc --noEmit` 和 Vite 测试环境构建。
3. 将 `dist/` 压缩并上传到服务器 `/tmp/consult-portal-test-时间戳.tgz`。
4. 解压到 `/data/web/releases/ai-estimating-work-weixin-test-时间戳/`。
5. 验证新版本存在 `index.html`，并设置静态文件读取权限。
6. 将旧 `/data/web/ai-estimating-work-weixin` 移到 `/data/web/backups/`。
7. 创建 `/data/web/ai-estimating-work-weixin` 软链接，指向新版本。
8. 检查软链接、入口文件及 `/ai-estimating-work-weixin/` 静态资源路径。

脚本不会发布后端、修改 Nginx 或自动重载 Nginx。执行成功会输出 `Portal published:` 和本次发布目录。

### 2.4 仅本地打包，不上传

```bash
cd /Users/kuzank/Desktop/leyu/code/ai-estimating-work-weixin
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build:test
grep -E '/ai-estimating-work-weixin/assets/' dist/index.html
```

输出目录是 `dist/`，不要直接上传源码或 `node_modules`。

## 3. 首次配置 Nginx（服务器执行）

将项目 `scripts/nginx-test.conf` 的内容加入 `test.yuecheers.com` 对应的 **HTTPS server 块**，保留证书及其他站点配置。配置如下：

```nginx
# 添加到 test.yuecheers.com 的 server 块；保留原有其他 location。
location = /ai-estimating-work-weixin {
    return 302 /ai-estimating-work-weixin/;
}
location ^~ /ai-estimating-work-weixin/api/ {
    proxy_pass http://127.0.0.1:8003/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "no-store" always;
}
location ^~ /ai-estimating-work-weixin/ {
    root /data/web;
    try_files $uri $uri/ /ai-estimating-work-weixin/index.html;
    add_header Referrer-Policy "no-referrer" always;
    add_header Cache-Control "no-cache" always;
}
```

其中 `127.0.0.1:8003` 是示例后端地址，必须核对为本环境实际后端地址和端口；两环境共用服务器时尤其不能代理到同一测试服务。

```bash
sudo nginx -t && sudo systemctl reload nginx
```

后续仅更新前端，无需重复修改或重载 Nginx。

## 4. 后端与企微应用配置

对应环境 yml：

```yaml
consult:
  staff-home-url: https://test.yuecheers.com/ai-estimating-work-weixin/
  staff-detail-url: https://test.yuecheers.com/ai-estimating-work-weixin/
```

修改后按服务端发布流程生效。企微应用菜单链接填写网站地址。已发出的通知仍保留发送时的旧链接，新配置不会重写历史消息。

## 5. 发布检查

```bash
curl -I https://test.yuecheers.com/ai-estimating-work-weixin/
```

- 首页及 JS/CSS 加载正常；浏览器接口请求走 `/ai-estimating-work-weixin/api/admin/consult/staff/...`。
- 登录后查看客户及所有订单摘要，验证单号搜索、订单详情和返回列表。
- 无订单时核对客户接口的 `orders` 字段，避免新前端配旧后端。
- 502 优先检查后端端口及代理；静态资源 404 检查构建路径与部署目录。
- 检查时无需触发真实企微通知。

## 6. 回退（服务器执行）

先列出备份，选择需要恢复的版本：

```bash
ls -ld /data/web/backups/ai-estimating-work-weixin-test-*
```

把下面的备份路径改为实际值后执行；先确认备份中有 `index.html`，当前版本也留存：

```bash
portal_backup='/data/web/backups/ai-estimating-work-weixin-test-实际时间戳'
portal_target='/data/web/ai-estimating-work-weixin'
if [ -s "$portal_backup/index.html" ]; then
  mv "$portal_target" "/data/web/backups/ai-estimating-work-weixin-test-before-rollback-$(date +%Y%m%d%H%M%S)" &&
  mv "$portal_backup" "$portal_target"
fi
```

回退只影响前端；后端接口须仍兼容目标版本。
