import { useState, useEffect } from 'react'
import { apiFetch } from './apiClient'

export function useReports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/api/reports?limit=10')
      .then(data => setReports(data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const daily  = reports.find(r => r.report_type === 'daily')  || null
  const weekly = reports.find(r => r.report_type === 'weekly') || null

  return { daily, weekly, loading }
}
