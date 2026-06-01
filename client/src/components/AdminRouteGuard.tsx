import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';

export default function AdminRouteGuard() {
  const { isAuthenticated, isLoading, user } = useSelector((state: RootState) => state.auth);
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
