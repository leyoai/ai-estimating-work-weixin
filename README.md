# 企微客户服务台

Vue 3 + TypeScript + Vite，适配手机与电脑。

- 安装：`pnpm install --frozen-lockfile`
- 开发：`pnpm dev`，默认5190端口，API代理本地8003。
- 检查：`pnpm typecheck`；构建：`pnpm build:test` / `pnpm build`。
- 测试部署：`pnpm deploy:test`，默认root@39.108.188.240，SSH密钥认证。
- 正式部署：设置 `DEPLOY_HOST` 后运行 `pnpm deploy:prod`；可选 `DEPLOY_USER`、`DEPLOY_PORT`。
- 测试路径：`/ai-estimating-work-weixin/`；正式路径：`/aeww/`，API 自动使用对应路径下的 `api/`。
- 完整操作：[测试环境部署](docs/test环境部署指南.md)、[正式环境部署](docs/prod环境部署指南.md)。
- 部署脚本自动安装锁定依赖，并将两环境发布到不同目录。

先执行服务端增量SQL，再发布服务端、后台前端及本站。Nginx片段见 `scripts/nginx-test.conf` 和 `scripts/nginx-prod.conf`，只添加location，不替换整个站点。发布版本保存在 `/data/web/releases/`，原版本位于 `/data/web/backups/`，回退可恢复备份指向。

账号需绑定企微员工且具备 `consult-staff:view` 权限。通知链接为30天的单订单只读凭据，打开后从地址栏移除，仅保存在页面内存中。刷新后可重新从通知打开；不保存到浏览器持久存储，不换取管理员Token。

未自动提交代码、发布正式环境或发送真实员工测试通知。

## 客户列表筛选

- 咨询状态支持“全部 / 已发起咨询 / 未发起咨询”，进入列表默认“已发起咨询”。
- 点击搜索（订单号、商户单号、交易单号或测评姓名）时自动切到“全部”；清空关键词后点击搜索同样查询全部状态。
- 搜索后可手动切换咨询状态，与已提交的关键词组合筛选；未点击搜索的输入不参与状态筛选。切换状态或搜索均回到第一页。
- 状态按客户有效咨询点击判断，与“最近发起咨询”一致：接受的 `CONSULT_OPEN_ATTEMPT` 或成功历史 `CLICK`，排除曝光、失败及已删除事件。客户下仍展示原本可见的承接订单。
- 服务端 `GET /admin/consult/staff/customers` 新增 `consultStatus=ALL|CONSULTED|NOT_CONSULTED`，省略时默认 `CONSULTED`；发布时先更新服务端，再更新本站。
