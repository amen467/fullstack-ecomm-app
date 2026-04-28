import { Outlet, Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from './store/store'
import './App.css'

function App() {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth)

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold text-blue-600">
            E-Shop
          </Link>

          <div className="flex items-center gap-6">
            <Link to="/products" className="text-gray-700 hover:text-blue-600 font-medium">
              Products
            </Link>

            <Link to="/cart" className="text-gray-700 hover:text-blue-600 font-medium">
              Cart
            </Link>

            {isAuthenticated ? (
              <div className="flex items-center gap-4">
                {user?.role === 'ADMIN' && (
                  <Link to="/admin" className="text-gray-700 hover:text-blue-600 font-medium">
                    Admin
                  </Link>
                )}
                <span className="text-gray-600">{user?.name}</span>
                <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex gap-4">
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-blue-600 font-medium"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white mt-12 py-8">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; 2026 E-Shop. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

export default App
