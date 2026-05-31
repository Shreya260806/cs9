import { Navigate } from 'react-router-dom'
import useAuthStore from '../store/useAuthStore'

function ProtectedRoute({ requiredRole, children }) {
  const user = useAuthStore((state) => state.user)
  const authChecked = useAuthStore((state) => state.authChecked)

  if (!authChecked) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-bg-primary text-[13px] text-text-muted">
        Checking session...
      </div>
    )
  }
  if (!user) return <Navigate to="/" replace />

  const roles = Array.isArray(user.roles) ? user.roles : [user.role].filter(Boolean)

  if (requiredRole && !roles.includes(requiredRole)) {
    return <Navigate to={roles.includes('ADMIN') ? '/admin/dashboard' : '/dashboard'} replace />
  }

  return children
}

export default ProtectedRoute
