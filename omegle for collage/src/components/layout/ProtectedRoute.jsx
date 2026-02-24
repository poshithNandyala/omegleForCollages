import { Navigate, useLocation } from 'react-router-dom'
import useAuthStore from '../../stores/authStore'
import { PageLoader } from '../ui/Loader'

export default function ProtectedRoute({ children }) {
    const { isAuthenticated, isLoading } = useAuthStore()
    const location = useLocation()

    if (isLoading) return <PageLoader />
    if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
    return children
}
