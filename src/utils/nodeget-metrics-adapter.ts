import { nodegetCall } from '@/utils/nodeget-adapter'

export async function nodegetListMetricDefinitions(): Promise<any[]> {
  const keys = [
    'cpu.usage',
    'load.average',
    'memory.used',
    'memory.total',
    'swap.used',
    'swap.total',
    'disk.used',
    'disk.total',
    'net.in.rate',
    'net.out.rate',
    'net.total.down',
    'net.total.up',
    'traffic.down',
    'traffic.up',
    'process.count',
    'connections.tcp',
    'connections.udp',
    'ping.latency_ms',
    'ping.loss',
  ]
  return keys.map(name => ({ name, description: name, type: 'gauge', retention_days: 30 }))
}

export async function nodegetGetPublicPingTasks(): Promise<any[]> {
  return []
}

function taskTime(value: unknown): number {
  const n = Number(value || 0)
  return n < 1e12 ? n * 1000 : n
}

export async function nodegetQueryMetrics(params: Record<string, any>): Promise<any> {
  const keys: string[] = params.metric_keys || params.metrics || []
  const wantsPing = keys.some(key => key === 'ping.latency_ms' || key === 'ping.loss')
  if (!wantsPing)
    return { start: new Date(Date.now() - (Number(params.hours || 1) * 3600000)).toISOString(), end: new Date().toISOString(), series: [], count: 0 }

  const uuid = params.entity_id || params.uuid
  const end = Date.now()
  const start = params.start ? Date.parse(params.start) : end - Number(params.hours || 1) * 3600000
  const conditions: unknown[] = []
  if (uuid)
    conditions.push({ uuid })
  const rows: any[] = []
  for (const type of ['ping', 'tcp_ping']) {
    const c = await nodegetCall<any>('task_query', { task_data_query: { condition: [...conditions, { type }, { timestamp_from_to: [start, end] }, { limit: 10000 }] } }).catch(() => [])
    if (Array.isArray(c))
      rows.push(...c)
  }
  const grouped = new Map<string, any[]>()
  for (const row of rows || []) {
    const result = row.task_event_result || {}
    const value = typeof result.ping === 'number' ? result.ping : typeof result.tcp_ping === 'number' ? result.tcp_ping : null
    if (value == null)
      continue
    const source = String(row.cron_source || 'ping')
    const list = grouped.get(source) || []
    list.push({ time: new Date(taskTime(row.timestamp)).toISOString(), value })
    grouped.set(source, list)
  }
  const series: any[] = []
  for (const [source, points] of grouped) {
    points.sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
    if (keys.includes('ping.latency_ms'))
      series.push({ metric_key: 'ping.latency_ms', entity_id: uuid || '', type: 'gauge', unit: 'ms', downsampled: false, count: points.length, points, tags: { cron_source: source } })
    if (keys.includes('ping.loss'))
      series.push({ metric_key: 'ping.loss', entity_id: uuid || '', type: 'gauge', unit: '%', downsampled: false, count: points.length, points: points.map(p => ({ ...p, value: 0 })), tags: { cron_source: source } })
  }
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString(), series, count: series.length }
}

export async function nodegetGetPublicPingMetricStats(params: Record<string, any>): Promise<any> {
  const result = await nodegetQueryMetrics({ ...params, metric_keys: ['ping.latency_ms'] })
  const stats = (result.series || []).map((series: any) => {
    const values = series.points.map((p: any) => Number(p.value)).filter(Number.isFinite)
    const avg = values.length ? values.reduce((a: number, b: number) => a + b, 0) / values.length : undefined
    return { entity_id: series.entity_id, task_id: String(series.tags?.cron_source || ''), name: series.tags?.cron_source, tags: series.tags || {}, total: values.length, valid: values.length, loss: 0, loss_approximate: true, min: values.length ? Math.min(...values) : undefined, max: values.length ? Math.max(...values) : undefined, avg, latest: values.at(-1) }
  })
  return { start: result.start, end: result.end, interval_seconds: 20, stats, count: stats.length }
}
