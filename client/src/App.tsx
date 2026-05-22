import axios from 'axios'
import { useEffect, useState } from 'react'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { authAPI, cartAPI } from './api/client'
import type { AppDispatch, RootState } from './store/store'
import { logout, setLoading, setToken, setUser } from './store/slices/authSlice'
import { clearCart, setCart } from './store/slices/cartSlice'
import './App.css'

function App() {
  const { isAuthenticated, isLoading, user } = useSelector((state: RootState) => state.auth)
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const [hasStoredToken, setHasStoredToken] = useState(() => Boolean(localStorage.getItem('token')))

  useEffect(() => {
    let isMounted = true
    const token = localStorage.getItem('token')

    async function hydrateSession() {
      if (!token) {
        dispatch(logout())
        dispatch(clearCart())
        dispatch(setLoading(false))
        setHasStoredToken(false)
        return
      }

      dispatch(setToken(token))
      dispatch(setLoading(true))
      setHasStoredToken(true)

      try {
        const userResponse = await authAPI.getCurrentUser()

        if (!isMounted) {
          return
        }

        dispatch(setUser(userResponse.data.user))

        const cartResponse = await cartAPI.getCart()

        if (isMounted) {
          dispatch(setCart(cartResponse.data))
        }
      } catch (error) {
        if (isMounted && axios.isAxiosError(error) && error.response?.status === 401) {
          localStorage.removeItem('token')
          dispatch(logout())
          dispatch(clearCart())
          setHasStoredToken(false)
        }
      } finally {
        if (isMounted) {
          dispatch(setLoading(false))
        }
      }
    }

    void hydrateSession()

    return () => {
      isMounted = false
    }
  }, [dispatch])

  const handleLogout = () => {
    localStorage.removeItem('token')
    dispatch(logout())
    dispatch(clearCart())
    setHasStoredToken(false)
    navigate('/')
  }

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

            {isLoading && hasStoredToken ? (
              <span className="text-gray-600">Loading...</span>
            ) : isAuthenticated ? (
              <div className="flex items-center gap-4">
                {user?.role === 'ADMIN' && (
                  <Link to="/admin" className="text-gray-700 hover:text-blue-600 font-medium">
                    Admin
                  </Link>
                )}
                <span className="text-gray-600">{user?.name}</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                >
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
