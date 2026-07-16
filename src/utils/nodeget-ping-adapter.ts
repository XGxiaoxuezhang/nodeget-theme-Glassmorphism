/* eslint-disable style/max-statements-per-line */
import type { PingRecord, PingTaskInfo } from '@/utils/rpc'
import { nodegetCall } from '@/utils/nodeget-adapter'

function toMs(ts: unknown): number { const n = Number(ts || 0); return n < 1e12 ? n * 1000 : n }
function iso(ts: number): string { return ts ? new Date(ts).toISOString() : new Date().toISOString() }

export async function nodegetGetPingRecords(taskId?: number, hours = 1, _maxCount = 500, uuid?: string): Promise<{ records: PingRecord[], tasks: PingTaskInfo[] }> {
  const end = Date.now()
  const start = end - Math.max(1, hours) * 3600000
  const windowMs = 24 * 3600000
  const windows: Array<{ from: number, to: number }> = []
  for (let from = start; from < end; from += windowMs)
    windows.push({ from, to: Math.min(end, from + windowMs) })
  const rows: any[] = []
  for (let index = 0; index < windows.length; index += 4) {
    const batch = windows.slice(index, index + 4).flatMap(({ from, to }) => ['ping', 'tcp_ping'].map((type) => {
      const condition: unknown[] = []
      if (uuid)
        condition.push({ uuid })
      if (taskId)
        condition.push({ task_id: taskId })
      condition.push({ type }, { timestamp_from: from }, { timestamp_to: to }, { limit: 10000 })
      return nodegetCall<any>('task_query', { task_data_query: { condition } }).catch(() => [])
    }))
    for (const response of await Promise.all(batch)) {
      const responseRows: any[] = Array.isArray(response) ? response : []
      rows.push(...responseRows)
    }
  }
  const records: PingRecord[] = []
  const tasks = new Map<string, PingTaskInfo>()
  for (const row of rows) {
    const result = row.task_event_result || {}
    const value = typeof result.ping === 'number' ? result.ping : typeof result.tcp_ping === 'number' ? result.tcp_ping : null
    if (value == null)
      continue
    const name = String(row.cron_source || 'ping')
    const id = Math.abs([...name].reduce((n, ch) => ((n * 31 + ch.charCodeAt(0)) | 0), 0))
    records.push({ client: String(row.uuid || uuid || ''), task_id: id, time: iso(toMs(row.timestamp)), value })
    if (!tasks.has(name))
      tasks.set(name, { id, name, interval: 20, loss: 0 })
  }
  return { records, tasks: [...tasks.values()] }
}
