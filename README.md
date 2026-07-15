# NodeGet Glassmorphism

一个给 NodeGet 用的公开监控主题。界面沿用了 Glassmorphism 的毛玻璃风格，数据部分改成通过 NodeGet WebSocket JSON-RPC 获取。

## 主要功能

- 节点列表、节点详情和实时状态
- CPU、内存、Swap、磁盘、负载、网络、连接数、进程数
- 真实历史负载曲线
- Ping / TCPing 历史和统计
- 延迟线路搜索与 Ping/TCPing 筛选
- 首页节点、流量、资源等汇总卡片
- 地区、标签、厂商和 ASN 展示
- NodeGet KV 中的价格、到期时间、流量额度等元数据
- 玻璃拟态、地球视图、详情图表和响应式布局

## 安全说明

这是公开只读探针，不是 NodeGet 管理后台。

公开 Token 只需要监控数据、Ping/TCPing、节点列表和 `metadata_*` / `traffic_*` 的读取权限。不要给公开 Token 授予以下权限：

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

主题不会在前端查询节点 IP，也不会把节点 IP 发送给第三方 GeoIP 服务。厂商、城市、国家和 ASN 使用脱敏 KV 字段：

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

这些字段不需要写 IP，也不需要修改节点名称。

## 配置

部署时创建 `public/config.json`。该文件不会提交到仓库，真实 Token 不要放进 Git：

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

## 从 NodeGet 主题管理安装

NodeGet 支持从远程 GitHub 仓库安装和更新符合主题规范的主题。在主题管理界面填写：

```text
https://github.com/XGxiaoxuezhang/nodeget-theme-Glassmorphism
```

NodeGet 会读取仓库中的主题清单和 Release 包。首次安装时按页面提示创建或选择公开只读 Token；更新时可以继续使用已有配置。

也可以在 Releases 页面下载 zip 手动安装：

<https://github.com/XGxiaoxuezhang/nodeget-theme-Glassmorphism/releases>

不要下载 GitHub 的源码压缩包，下载带有 `nodeget-theme-Glassmorphism-build-` 前缀的主题 zip。

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

zip 内的布局固定为：

```text
komari-theme.json
preview.png
dist/
```

## 数据接口

适配器主要使用以下 NodeGet 方法：

```text
nodeget-server_list_all_agent_uuid
agent_static_data_multi_last_query
agent_dynamic_summary_multi_last_query
agent_query_dynamic_summary
kv_get_multi_value
task_query
```

## 开源信息

- 仓库：<https://github.com/XGxiaoxuezhang/nodeget-theme-Glassmorphism>
- 维护者：<https://github.com/XGxiaoxuezhang>
- NodeGet：<https://nodeget.com/>
- 上游参考：<https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism>
- License：MIT
