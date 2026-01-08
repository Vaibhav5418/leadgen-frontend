import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  const token = localStorage.getItem('token');
  
  // If no token, redirect to login (though PrivateRoute should handle this)
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
