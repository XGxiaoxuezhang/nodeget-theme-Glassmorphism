# NodeGet Glassmorphism

NodeGet Glassmorphism 是一个给 NodeGet 使用的公开监控主题。界面沿用毛玻璃风格，数据部分通过 NodeGet WebSocket JSON-RPC 获取。

## 功能

- 节点列表、详情和实时状态
- CPU、内存、Swap、磁盘、负载、网络、连接数和进程数
- 历史负载曲线
- Ping / TCPing 历史和统计
- 延迟线路搜索与 Ping/TCPing 筛选
- 首页资源、流量和节点状态汇总
- 地区、标签、厂商和 ASN 展示
- NodeGet KV 元数据：价格、到期时间和流量额度
- 响应式布局、地球视图、图表和主题设置

## 安全

这是公开只读探针，不是 NodeGet 管理后台。公开 Token 不应拥有以下权限：

```text
execute
web_shell
read_config
edit_config
self_update
http_request
crontab 写入或删除
KV 写入或删除
```

主题不会在前端查询节点 IP，也不会把 IP 发送给第三方 GeoIP 服务。厂商和网络信息使用脱敏 KV：

```text
metadata_provider
metadata_city
metadata_country
metadata_asn
metadata_public_remark
```

例如：

```text
metadata_provider = Oracle Cloud
metadata_city = Montreal
metadata_country = CA
metadata_asn = AS31898
```

不需要修改节点名称，也不要把 IP、密码或 Token 写入这些字段。

## 从 NodeGet 主题管理安装

NodeGet 支持从 GitHub 仓库远程安装和更新主题。在主题管理中填写：

```text
https://github.com/XGxiaoxuezhang/nodeget-theme-Glassmorphism
```

如果使用 Release 下载，打开：

<https://github.com/XGxiaoxuezhang/nodeget-theme-Glassmorphism/releases>

下载名称以 `nodeget-theme-Glassmorphism-build-` 开头的 zip，不要下载 GitHub 自动生成的源码压缩包。

## 配置

部署时创建 `public/config.json`。该文件已加入 `.gitignore`，真实 Token 不要提交到 Git：

```json
{
  "user_preferences": {
    "site_name": "NodeGet Glassmorphism",
    "site_title": "NodeGet Glassmorphism",
    "footer": "Powered by NodeGet"
  },
  "site_tokens": [
    {
      "name": "公开状态页",
      "backend_url": "wss://your-nodeget.example/nodeget/rpc",
      "token": "REPLACE_WITH_READ_ONLY_TOKEN"
    }
  ]
}
```

## 本地开发

环境要求：Node.js `^20.19.0` 或 `>=22.12.0`，Bun `>=1.2.0`。

```bash
bun install
bun run dev
bun run lint
bun run build
bun run preview
```

构建会生成：

```text
dist/
nodeget-theme-Glassmorphism-build-<short-sha>.zip
```

## 上游同步

本仓库是独立维护的 NodeGet 版本，上游为：

```text
https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism
```

仓库提供 `Sync upstream changes` 工作流，支持手动或每周检查上游更新。同步结果先进入 PR，不会自动覆盖 `main`。合并前需要确认 NodeGet 适配层、公开 Token 权限和 IP 隐私逻辑没有被上游改动破坏。

## 开源信息

- 仓库：<https://github.com/XGxiaoxuezhang/nodeget-theme-Glassmorphism>
- 维护者：<https://github.com/XGxiaoxuezhang>
- NodeGet：<https://nodeget.com/>
- 上游参考：<https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism>
- License：MIT
