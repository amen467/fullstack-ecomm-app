import axios from 'axios';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ordersAPI, type Order } from '../api/client';

export default function OrderConfirmationPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasStoredToken()) {
      navigate('/login', { state: { from: location }, replace: true });
      return;
    }

    const orderId = Number(id);

    if (!Number.isInteger(orderId) || orderId < 1) {
      setPageError('Order not found');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadOrder() {
      setIsLoading(true);
      setPageError(null);

      try {
        const response = await ordersAPI.getById(orderId);

        if (isMounted) {
          setOrder(response.data.order);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (axios.isAxiosError(error) && error.response?.status === 401) {
          navigate('/login', { state: { from: location }, replace: true });
          return;
        }

        setPageError(getErrorMessage(error, 'We could not load this order.'));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadOrder();

    return () => {
      isMounted = false;
    };
  }, [id, location, navigate]);

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-lg bg-gray-100 p-6">
          <p className="text-lg text-gray-600">Loading order...</p>
        </div>
      </div>
    );
  }

  if (pageError || !order) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <p className="mb-4 font-medium text-red-700">{pageError ?? 'Order not found'}</p>
          <Link
            to="/products"
            className="inline-block rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="mb-4 text-4xl font-bold">Order Confirmed!</h1>
        <p className="mb-4 text-xl text-gray-600">Thank you for your purchase</p>
        <p className="text-2xl font-bold text-green-600">Order #{order.id}</p>
      </div>

      <section className="mb-6 rounded-lg bg-gray-50 p-6">
        <h2 className="mb-4 text-2xl font-bold">Order Details</h2>
        <div className="space-y-3">
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Order Date:</span>
            <span className="text-right">{formatDate(order.createdAt)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Status:</span>
            <span className="font-semibold text-blue-600">{formatStatus(order.status)}</span>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-lg bg-gray-50 p-6">
        <h2 className="mb-4 text-2xl font-bold">Order Items</h2>
        <div className="space-y-4">
          {order.items.map((item) => (
            <article key={item.id} className="flex gap-4 rounded-lg border border-gray-200 bg-white p-4">
              <Link to={`/products/${item.productId}`} className="shrink-0 overflow-hidden rounded-md bg-gray-100">
                <img
                  src={item.product.imageUrl}
                  alt={item.product.name}
                  className="h-20 w-20 object-cover"
                />
              </Link>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-blue-600">{item.product.category.name}</p>
                <h3 className="font-semibold text-gray-900">
                  <Link to={`/products/${item.productId}`} className="hover:text-blue-600">
                    {item.product.name}
                  </Link>
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  {item.quantity} x {formatPrice(item.unitPrice)}
                </p>
              </div>

              <div className="text-right font-semibold text-gray-900">
                {formatPrice(item.lineTotal)}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded-lg bg-blue-50 p-6">
        <h2 className="mb-4 text-2xl font-bold">Order Summary</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{formatPrice(order.totalAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span>Shipping:</span>
            <span>$0.00</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-lg font-bold">
            <span>Total:</span>
            <span>{formatPrice(order.totalAmount)}</span>
          </div>
        </div>
      </section>

      <Link
        to="/products"
        className="block w-full rounded-lg bg-blue-600 py-3 text-center font-semibold text-white hover:bg-blue-700"
      >
        Continue Shopping
      </Link>
    </div>
  );
}

function hasStoredToken() {
  return Boolean(localStorage.getItem('token'));
}

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback;
  }

  return fallback;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatStatus(status: Order['status']) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function formatPrice(price: string) {
  const value = Number.parseFloat(price);

  if (Number.isNaN(value)) {
    return price;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}
