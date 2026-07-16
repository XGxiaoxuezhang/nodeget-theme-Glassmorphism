/* eslint-disable style/max-statements-per-line */
import type { Client, NodeStatus, StatusRecord, VersionInfo } from '@/utils/rpc'

interface ThemeConfig { site_tokens?: Array<{ name?: string, backend_url: string, token: string }>, user_preferences?: Record<string, unknown> }
interface NodeGetEntry { backend_url: string, token: string }

let configPromise: Promise<ThemeConfig> | null = null
let rpcClient: NodeGetRpcClient | null = null
let cachedClients: Record<string, Client> = {}
let cachedStatuses: Record<string, NodeStatus> = {}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null)
    return fallback
  if (typeof value !== 'string')
    return value as T
  try { return JSON.parse(value) as T }
  catch { return value as T }
}
function toMs(ts: unknown): number { const n = Number(ts || 0); return n < 1e12 ? n * 1000 : n }
function iso(ts: number): string { return ts ? new Date(ts).toISOString() : new Date().toISOString() }
async function loadConfig(): Promise<ThemeConfig> {
  if (!configPromise)
    configPromise = fetch('./config.json', { cache: 'no-store' }).then(r => r.json())
  return configPromise
}
async function getEntry(): Promise<NodeGetEntry> {
  const cfg = await loadConfig()
  const entry = cfg.site_tokens?.[0]
  if (!entry?.backend_url || !entry?.token)
    throw new Error('NodeGet theme config missing site_tokens[0]')
  return entry
}

class NodeGetRpcClient {
  private ws: WebSocket | null = null
  private ready: Promise<void> | null = null
  private id = 0
  private pending = new Map<number, { resolve: (v: unknown) => void, reject: (e: unknown) => void, timer: ReturnType<typeof setTimeout> }>()
  constructor(private entry: NodeGetEntry) {}
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN)
      return
    if (this.ready)
      return this.ready
    this.ready = new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.entry.backend_url)
      const timer = setTimeout(() => reject(new Error('NodeGet WebSocket timeout')), 12000)
      ws.onopen = () => { clearTimeout(timer); this.ws = ws; resolve() }
      ws.onerror = () => { clearTimeout(timer); reject(new Error('NodeGet WebSocket error')) }
      ws.onclose = () => { this.ws = null; this.ready = null }
      ws.onmessage = (ev) => {
        let msg: any
        try { msg = JSON.parse(ev.data) }
        catch { return }
        const p = this.pending.get(msg.id)
        if (!p)
          return
        clearTimeout(p.timer)
        this.pending.delete(msg.id)
        if (msg.error)
          p.reject(new Error(msg.error.message || 'NodeGet RPC error'))
        else p.resolve(msg.result)
      }
    }).finally(() => { this.ready = null })
    await this.ready
  }

  async call<T>(method: string, params: Record<string, unknown> = {}, timeout = 20000): Promise<T> {
    await this.connect()
    const id = ++this.id
    const payload = { jsonrpc: '2.0', method, params: { token: this.entry.token, ...params }, id }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} timeout`)) }, timeout)
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer })
      this.ws!.send(JSON.stringify(payload))
    })
  }

  close(): void { this.ws?.close(); this.ws = null }
}
async function client(): Promise<NodeGetRpcClient> {
  if (!rpcClient)
    rpcClient = new NodeGetRpcClient(await getEntry()); return rpcClient
}
function firstValue(obj: any, keys: string[], fallback = 0): number {
  for (const k of keys) {
    const v = Number(obj?.[k]); if (Number.isFinite(v))
      return v
  } return fallback
}
function kvValue(kv: Record<string, any>, key: string, fallback: any = ''): any { return parseJson(kv[key], fallback) }
function normalizeMap(payload: any): Record<string, any> {
  if (!payload)
    return {}
  if (payload.data)
    payload = payload.data
  if (Array.isArray(payload)) {
    const out: Record<string, any> = {}; for (const row of payload) {
      if (row.uuid)
        out[row.uuid] = row
    } return out
  }
  return payload
}

export async function nodegetCall<T>(method: string, params: Record<string, unknown> = {}): Promise<T> { return (await client()).call<T>(method, params) }

export async function nodegetPing(): Promise<string> { return 'pong' }
export function nodegetClose(): void { rpcClient?.close(); rpcClient = null }
export async function nodegetGetVersion(): Promise<VersionInfo> { return { version: 'nodeget-adapter', hash: 'nodeget' } }
export async function nodegetPublicInfo(): Promise<any> {
  const cfg = await loadConfig()
  return { sitename: String(cfg.user_preferences?.site_name || cfg.user_preferences?.site_title || 'NodeGet'), description: '', theme: 'NodeGetGlassmorphism', private_site: false, allow_cors: true, custom_body: '', custom_head: '', disable_password_login: true, oauth_enable: false, oauth_provider: null, record_preserve_time: 720, ping_record_preserve_time: 168, theme_settings: { dataUpdateInterval: 3, rpcTransportMode: 'websocket', nodeDetailSectionTabsEnabled: true } }
}

export async function nodegetGetNodes(): Promise<Record<string, Client>> {
  const c = await client()
  const list: any = await c.call('nodeget-server_list_all_agent_uuid', {})
  const uuids = (list?.uuids || list || []).map((x: any) => typeof x === 'string' ? x : x.uuid).filter(Boolean)
  const kvReq: Array<{ namespace: string, key: string }> = []
  const keys = ['metadata_name', 'metadata_region', 'metadata_provider', 'metadata_city', 'metadata_public_remark', 'metadata_price', 'metadata_price_unit', 'metadata_price_cycle', 'metadata_expire_time', 'metadata_tags', 'metadata_hidden', 'metadata_order', 'metadata_group', 'metadata_traffic_limit']
  for (const u of uuids) {
    for (const key of keys) kvReq.push({ namespace: u, key })
  }
  const [staticPayload, kvRows] = await Promise.all([
    c.call('agent_static_data_multi_last_query', { uuids, fields: ['cpu', 'system', 'gpu'] }).catch(() => ({})),
    c.call('kv_get_multi_value', { namespace_key: kvReq }).catch(() => []),
  ])
  const statics = normalizeMap(staticPayload)
  const kvByNs: Record<string, Record<string, any>> = {}
  for (const row of Array.isArray(kvRows) ? kvRows : []) {
    if (!row.namespace || !row.key)
      continue
    const namespace = String(row.namespace); const key = String(row.key)
    kvByNs[namespace] ||= {}; kvByNs[namespace][key] = row.value
  }
  const out: Record<string, Client> = {}
  for (const uuid of uuids) {
    const kv = kvByNs[uuid] || {}; const st = statics[uuid] || {}
    const sys = parseJson<any>(st.system || st.system_data, {})
    const cpu = parseJson<any>(st.cpu || st.cpu_data, {})
    const tags = kvValue(kv, 'metadata_tags', '')
    const provider = String(kvValue(kv, 'metadata_provider', ''))
    const city = String(kvValue(kv, 'metadata_city', ''))
    const publicRemark = String(kvValue(kv, 'metadata_public_remark', ''))
    out[uuid] = { uuid, name: String(kvValue(kv, 'metadata_name', uuid.slice(0, 8))), cpu_name: cpu.brand || cpu.per_core?.[0]?.brand || '-', virtualization: sys.virtualization || '', arch: sys.system_arch || sys.arch || '', cpu_cores: cpu.logical_cores || cpu.physical_cores || cpu.per_core?.length || 1, cpu_physical_cores: cpu.physical_cores || undefined, os: sys.system_os_long_version || sys.system_name || sys.system_os_version || '-', kernel_version: sys.system_kernel || sys.system_kernel_version || '', gpu_name: '', ipv4: '', ipv6: '', region: String(kvValue(kv, 'metadata_region', city)), provider, city, country: String(kvValue(kv, 'metadata_country', '')), asn: String(kvValue(kv, 'metadata_asn', '')), remark: provider, public_remark: publicRemark, mem_total: 0, swap_total: 0, disk_total: 0, weight: Number(kvValue(kv, 'metadata_order', 0)) || 0, price: Number(kvValue(kv, 'metadata_price', 0)) || 0, billing_cycle: Number(kvValue(kv, 'metadata_price_cycle', 30)) || 30, auto_renewal: false, currency: String(kvValue(kv, 'metadata_price_unit', 'CNY')), expired_at: String(kvValue(kv, 'metadata_expire_time', '')), group: String(kvValue(kv, 'metadata_group', kvValue(kv, 'metadata_region', ''))), tags: Array.isArray(tags) ? tags.join(',') : String(tags || ''), hidden: Boolean(kvValue(kv, 'metadata_hidden', false)), traffic_limit: Number(kvValue(kv, 'metadata_traffic_limit', 0)) || 0, traffic_limit_type: 'sum', created_at: '', updated_at: '' }
  }
  cachedClients = out
  return out
}

export async function nodegetGetStatuses(): Promise<Record<string, NodeStatus>> {
  const c = await client()
  const uuids = Object.keys(cachedClients).length ? Object.keys(cachedClients) : Object.keys(await nodegetGetNodes())
  const fields = ['cpu_usage', 'gpu_usage', 'used_swap', 'total_swap', 'used_memory', 'total_memory', 'load_one', 'load_five', 'load_fifteen', 'uptime', 'process_count', 'total_space', 'available_space', 'tcp_connections', 'udp_connections', 'total_received', 'total_transmitted', 'transmit_speed', 'receive_speed']
  const dyn = normalizeMap(await c.call('agent_dynamic_summary_multi_last_query', { uuids, fields }).catch(() => ({})))
  const out: Record<string, NodeStatus> = {}; const t = Date.now()
  for (const uuid of uuids) out[uuid] = nodegetSummaryToStatus(uuid, dyn[uuid] || {}, t)
  cachedStatuses = out
  return out
}

function nodegetSummaryToStatus(uuid: string, d: any, now = Date.now()): NodeStatus {
  const ts = toMs(d.timestamp || d.storage_time)
  const memTotal = firstValue(d, ['total_memory']); const swapTotal = firstValue(d, ['total_swap']); const diskTotal = firstValue(d, ['total_space'])
  const diskUsed = Math.max(0, diskTotal - firstValue(d, ['available_space']))
  return { client: uuid, time: iso(ts), cpu: firstValue(d, ['cpu_usage']), gpu: firstValue(d, ['gpu_usage']), ram: firstValue(d, ['used_memory']), ram_total: memTotal, swap: firstValue(d, ['used_swap']), swap_total: swapTotal, load: firstValue(d, ['load_one']), load5: firstValue(d, ['load_five']), load15: firstValue(d, ['load_fifteen']), temp: 0, disk: diskUsed, disk_total: diskTotal, net_in: firstValue(d, ['receive_speed']), net_out: firstValue(d, ['transmit_speed']), net_total_up: firstValue(d, ['total_transmitted']), net_total_down: firstValue(d, ['total_received']), traffic_up: firstValue(d, ['total_transmitted']), traffic_down: firstValue(d, ['total_received']), process: firstValue(d, ['process_count']), connections: firstValue(d, ['tcp_connections']), connections_udp: firstValue(d, ['udp_connections']), online: Boolean(ts && now - ts < 30000), uptime: firstValue(d, ['uptime']), updated_at: iso(ts) }
}

function _statusToRecord(s: NodeStatus): StatusRecord {
  return { client: s.client, time: s.time, cpu: s.cpu, gpu: s.gpu, ram: s.ram, ram_total: s.ram_total, swap: s.swap, swap_total: s.swap_total, load: s.load, load5: s.load5, load15: s.load15, temp: s.temp, disk: s.disk, disk_total: s.disk_total, net_in: s.net_in, net_out: s.net_out, net_total_up: s.net_total_up, net_total_down: s.net_total_down, traffic_up: s.traffic_up, traffic_down: s.traffic_down, process: s.process, connections: s.connections, connections_udp: s.connections_udp }
}

export async function nodegetGetNodeRecentStatus(uuid: string, limit = 150): Promise<{ count: number, records: StatusRecord[] }> {
  const records = await nodegetQueryHistoricalSummary(uuid, 1, Math.min(limit, 1000))
  return { count: records.length, records }
}
export async function nodegetGetLoadRecords(uuid?: string, hours = 1, maxCount = 150): Promise<{ records: StatusRecord[] | Record<string, StatusRecord[]> }> {
  const ids = uuid ? [uuid] : Object.keys(cachedStatuses).length ? Object.keys(cachedStatuses) : Object.keys(await nodegetGetNodes())
  const recordsByUuid: Record<string, StatusRecord[]> = {}
  await Promise.all(ids.map(async (id) => { recordsByUuid[id] = await nodegetQueryHistoricalSummary(id, hours, maxCount) }))
  return uuid ? { records: recordsByUuid[uuid] ?? [] } : { records: recordsByUuid }
}

async function nodegetQueryHistoricalSummary(uuid: string, hours: number, _maxCount: number): Promise<StatusRecord[]> {
  const end = Date.now()
  const start = end - Math.max(1, hours) * 3600000
  const fields = ['cpu_usage', 'gpu_usage', 'used_swap', 'total_swap', 'used_memory', 'total_memory', 'load_one', 'load_five', 'load_fifteen', 'uptime', 'process_count', 'total_space', 'available_space', 'tcp_connections', 'udp_connections', 'total_received', 'total_transmitted', 'transmit_speed', 'receive_speed']
  const windowMs = 2 * 3600000
  const windows: Array<{ from: number, to: number }> = []
  for (let from = start; from < end; from += windowMs)
    windows.push({ from, to: Math.min(end, from + windowMs) })

  const results: any[] = []
  for (let index = 0; index < windows.length; index += 4) {
    const batch = windows.slice(index, index + 4).map(({ from, to }) => nodegetCall<any[]>('agent_query_dynamic_summary', {
      query: { condition: [{ uuid }, { timestamp_from: from }, { timestamp_to: to }, { limit: 10000 }], fields },
    }).catch(() => []))
    for (const result of await Promise.all(batch)) {
      const rows = Array.isArray(result) ? result : []
      results.push(...rows)
    }
  }

  const unique = new Map<string, any>()
  for (const row of results)
    unique.set(`${uuid}:${row.timestamp}`, row)
  return Array.from(unique.values(), row => nodegetSummaryToRecord(uuid, row))
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
}

function nodegetSummaryToRecord(uuid: string, d: any): StatusRecord {
  const status = nodegetSummaryToStatus(uuid, d, Number.MAX_SAFE_INTEGER)
  return { client: uuid, time: iso(toMs(d.timestamp)), cpu: status.cpu, gpu: status.gpu, ram: status.ram, ram_total: status.ram_total, swap: status.swap, swap_total: status.swap_total, load: status.load, load5: status.load5, load15: status.load15, temp: status.temp, disk: status.disk, disk_total: status.disk_total, net_in: status.net_in, net_out: status.net_out, net_total_up: status.net_total_up, net_total_down: status.net_total_down, traffic_up: status.traffic_up, traffic_down: status.traffic_down, process: status.process, connections: status.connections, connections_udp: status.connections_udp }
}
