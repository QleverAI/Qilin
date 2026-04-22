import { Navigate, useLocation } from 'react-router-dom'

export default function ProtectedRoute({ children }) {
  const token = sessionStorage.getItem('qilin_token')
  const location = useLocation()
  if (!token) {
    return <Navigate to="/login" state={{ next: location.pathname }} replace />
  }
  return children
}
