import React, { useEffect, useState } from 'react'
import { History, ShieldAlert } from 'lucide-react'
import api from '../../services/api'
import Pagination from '../../components/ui/Pagination'
import EmptyState from '../../components/ui/EmptyState'

export default function ActivityLog() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const loadLogs = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/v1/activity', { params: { page, limit: 15 } })
      setLogs(res.data.data || [])
      setTotal(res.data.meta?.total || 0)
    } catch (err) {
      console.error('[ActivityLog] Failed to load logs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [page])

  return (
    <div className="space-y-6">
      {/* Page Banner */}
      <div className="page-banner">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 className="page-banner-title">System Audit Trail</h1>
          <p className="page-banner-sub">Trace user operations, entity changes, and workspace activity</p>
        </div>
      </div>


      <div className="card">
        {loading ? (
          <div className="p-8 text-center">
            <div className="spinner mx-auto" />
          </div>
        ) : logs.length > 0 ? (
          <div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User Details</th>
                    <th>Action</th>
                    <th>Resource Target</th>
                    <th>IP Address</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {log.user_name || 'System Auto'}
                        </div>
                      </td>
                      <td>
                        <span className="text-xs font-semibold uppercase bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-mono">
                          {log.action}
                        </span>
                      </td>
                      <td className="capitalize font-medium">
                        {log.entity_type} (ID: {log.entity_id})
                      </td>
                      <td className="font-mono text-slate-500 text-xs">
                        {log.ip_address || '::1'}
                      </td>
                      <td className="text-slate-400 text-xs">
                        {log.created_at || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {total > 15 && (
              <div className="p-4 border-t border-slate-100">
                <Pagination
                  page={page}
                  total={total}
                  limit={15}
                  onPageChange={(p) => setPage(p)}
                />
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            title="Audit log is empty"
            description="There are no recorded log entries on this workspace yet."
            icon={ShieldAlert}
          />
        )}
      </div>
    </div>
  )
}
