import axios from 'axios';
import { type FormEvent, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authAPI, cartAPI } from '../api/client';
import { setError, setLoading, setToken, setUser } from '../store/slices/authSlice';
import { setCart } from '../store/slices/cartSlice';
import type { AppDispatch } from '../store/store';

export default function LoginPage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    dispatch(setLoading(true));
    dispatch(setError(null));

    try {
      const response = await authAPI.login({ email, password });
      const { token, user } = response.data;

      localStorage.setItem('token', token);
      dispatch(setToken(token));
      dispatch(setUser(user));
      await syncCartAfterAuth(dispatch);
      navigate(getReturnPath(location.state), { replace: true });
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to sign in');
      setFormError(message);
      dispatch(setError(message));
    } finally {
      setIsSubmitting(false);
      dispatch(setLoading(false));
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <h1 className="text-4xl font-bold mb-8 text-center">Sign In</h1>
      
      <form className="space-y-4" onSubmit={handleSubmit}>
        {formError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </p>
        )}

        <div>
          <label className="block text-sm font-medium mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="user@example.com"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Password"
          />
        </div>
        
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      
      <p className="text-center mt-6 text-gray-600">
        Don't have an account?{' '}
        <Link to="/register" className="text-blue-600 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}

async function syncCartAfterAuth(dispatch: AppDispatch) {
  try {
    const cartResponse = await cartAPI.getCart();
    dispatch(setCart(cartResponse.data));
  } catch {
    // Login succeeded; the cart can be retried by app hydration or the cart page.
  }
}

function getReturnPath(state: unknown) {
  if (
    typeof state === 'object' &&
    state !== null &&
    'from' in state &&
    typeof state.from === 'object' &&
    state.from !== null &&
    'pathname' in state.from &&
    typeof state.from.pathname === 'string'
  ) {
    const search = 'search' in state.from && typeof state.from.search === 'string'
      ? state.from.search
      : '';

    return `${state.from.pathname}${search}`;
  }

  return '/';
}

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback;
  }

  return fallback;
}
