<div align="center">

# 🌌 NodeGet Glassmorphism

## NodeGet 的玻璃拟态公开监控主题

保留 Glassmorphism 的毛玻璃界面、节点卡片、地球与详情图表，同时将数据层适配到 NodeGet JSON-RPC。项目面向公开只读探针，不提供 NodeGet 管理后台、命令执行或 WebShell。

[![NodeGet](https://img.shields.io/badge/NodeGet-adapter-10b981?style=for-the-badge)](https://nodeget.com/)
[![Vue](https://img.shields.io/badge/Vue-3-42b883?style=for-the-badge&logo=vue.js)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-7-646cff?style=for-the-badge&logo=vite)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-v4-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![Bun](https://img.shields.io/badge/Bun-%3E%3D1.2-000000?style=for-the-badge&logo=bun)](https://bun.sh/)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

**维护者：** [XGxiaoxuezhang](https://github.com/XGxiaoxuezhang) · **仓库：** [XGxiaoxuezhang/nodeget-theme-Glassmorphism](https://github.com/XGxiaoxuezhang/nodeget-theme-Glassmorphism)

</div>

---

## 项目定位

| 项目     | 说明                                   |
| :------- | :------------------------------------- |
| 主题名称 | NodeGet Glassmorphism                  |
| 目标后端 | NodeGet Server                         |
| 前端技术 | Vue 3 + Vite + Pinia + Tailwind CSS v4 |
| 主题类型 | NodeGet 公开只读状态页                 |
| 视觉基础 | Glassmorphism 毛玻璃界面               |
| 构建方式 | Bun                                    |

本项目不是 NodeGet 管理后台。管理、Agent 配置、任务创建、终端和更新操作请使用 NodeGet 官方 Dashboard。

## 功能

### NodeGet 数据适配

- 节点列表和静态信息
- 实时 CPU、内存、Swap、磁盘、Load、网络、连接数和进程数
- 真实历史负载曲线
- Ping / TCPing 历史数据
- 平均、最小、最大、最新延迟和丢包统计
- Ping / TCPing 类型筛选和线路搜索
- 首页在线节点、平均 CPU、内存、硬盘、流量和连接总览
- NodeGet KV 元数据：厂商、城市、国家、ASN、标签、价格、到期时间和流量额度

### 公开探针安全边界

公开页面只使用最小只读 Token，适配层不会调用管理能力：

- 不提供后台管理入口
- 不执行命令，不提供 WebShell
- 不创建或修改任务、定时任务和配置
- 不调用 `read_config`、`edit_config`、`self_update` 等管理能力
- 不把真实 Token、密码或 SSH 凭据提交到仓库
- 不进行前端 IP/GeoIP 查询，不把节点 IP 发送给第三方 GeoIP 服务
- ASN 和厂商信息只使用脱敏 KV 元数据，不显示节点 IP

## NodeGet 公开 Token 权限建议

建议为公开主题单独创建只读 Token，只授予以下范围：

```text
node_get: list_all_agent_uuid
static_monitoring: read(cpu/system/gpu)
dynamic_monitoring_summary: read
task: read(ping/tcp_ping)
kv: read(metadata_*)
kv: read(traffic_*)
```

不要授予公开 Token 以下能力：

```text
execute
web_shell
read_config
edit_config
self_update
http_request
crontab write/delete
kv write/delete
```

## 配置

部署时在 `public/config.json` 提供配置文件。该文件已加入 `.gitignore`，不要提交真实 Token：

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

### 脱敏厂商元数据

主题会自动读取以下 NodeGet KV 键；没有设置时不会报错：

```text
metadata_provider
metadata_city
metadata_country
metadata_asn
metadata_public_remark
```

示例：

```text
metadata_provider = Oracle Cloud
metadata_city = Montreal
metadata_country = CA
metadata_asn = AS31898
```

这些字段只用于显示厂商、城市、国家和 ASN，不应写入 IPv4、IPv6、密码或其他敏感信息。节点名称不需要修改。

## 安装与部署

1. 使用 Bun 构建主题。
2. 将构建产物中的 `dist/` 上传到 NodeGet 静态主题目录。
3. 将部署环境自己的 `public/config.json` 放入静态目录。
4. 在 NodeGet Dashboard 中将主题设置为 HTTP root。
5. 使用浏览器强制刷新确认页面和 WebSocket 正常。

公开探针的管理入口使用 NodeGet 官方 Dashboard，不要把管理 Token 放入前端配置。

## 本地开发

环境要求：Node.js `^20.19.0` 或 `>=22.12.0`，Bun `>=1.2.0`。

```bash
bun install
bun run dev
bun run lint
bun run build
bun run preview
```

构建输出包括：

```text
dist/
nodeget-theme-Glassmorphism-build-<short-sha>.zip
```

发布包固定包含：

```text
komari-theme.json
preview.png
dist/
```

## 数据调用链

```text
Vue Component
    ↓
Composable
    ↓
Service
    ↓
RequestManager / CacheService
    ↓
NodeGet WebSocket JSON-RPC
```

主要 NodeGet 方法：

```text
nodeget-server_list_all_agent_uuid
agent_static_data_multi_last_query
agent_dynamic_summary_multi_last_query
agent_query_dynamic_summary
kv_get_multi_value
task_query
```

## 开源说明

本项目是 NodeGet 专用的 Glassmorphism 公开监控主题，保留原始 Glassmorphism 项目的视觉设计和 MIT License，并由 [XGxiaoxuezhang](https://github.com/XGxiaoxuezhang) 维护。

上游参考：<https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism>

## License

[MIT](LICENSE)
