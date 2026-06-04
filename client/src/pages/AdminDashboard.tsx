import axios from 'axios';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI, type AdminDashboardStats } from '../api/client';

const emptyStats: AdminDashboardStats = {
  totalProducts: 0,
  totalOrders: 0,
  totalRevenue: '0',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminDashboardStats>(emptyStats);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadStats() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await adminAPI.getStats();

        if (isMounted) {
          setStats(response.data.stats);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(getErrorMessage(loadError, 'Unable to load dashboard stats.'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadStats();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-4xl font-bold">Admin Dashboard</h1>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <p className="text-sm text-gray-600">Total Products</p>
          <p className="mt-2 text-3xl font-bold">{formatCount(stats.totalProducts, isLoading)}</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <p className="text-sm text-gray-600">Total Orders</p>
          <p className="mt-2 text-3xl font-bold">{formatCount(stats.totalOrders, isLoading)}</p>
        </div>
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-6">
          <p className="text-sm text-gray-600">Total Revenue</p>
          <p className="mt-2 text-3xl font-bold">{isLoading ? 'Loading...' : formatCurrency(stats.totalRevenue)}</p>
        </div>
      </div>

      <div className="rounded-lg bg-gray-50 p-6">
        <h2 className="mb-4 text-2xl font-bold">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Link
            to="/admin/products"
            className="block rounded-lg border border-gray-200 bg-white p-4 transition hover:border-blue-500 hover:shadow-lg"
          >
            <h3 className="text-lg font-semibold">Manage Products</h3>
            <p className="mt-1 text-sm text-gray-600">Add, edit, or delete products</p>
          </Link>
          <Link
            to="/admin/orders"
            className="block rounded-lg border border-gray-200 bg-white p-4 transition hover:border-blue-500 hover:shadow-lg"
          >
            <h3 className="text-lg font-semibold">View Orders</h3>
            <p className="mt-1 text-sm text-gray-600">Manage customer orders</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

function formatCount(value: number, isLoading: boolean) {
  return isLoading ? 'Loading...' : value.toLocaleString();
}

function formatCurrency(value: string) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return '$0.00';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(numericValue);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback;
  }

  return fallback;
}
