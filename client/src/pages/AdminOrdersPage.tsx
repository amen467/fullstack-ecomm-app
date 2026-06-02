import axios from 'axios';
import { Fragment, useEffect, useState } from 'react';
import { ordersAPI, type AdminOrder } from '../api/client';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadOrders() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await ordersAPI.getAll();

        if (isMounted) {
          setOrders(response.data.orders);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(getErrorMessage(loadError, 'Unable to load orders.'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadOrders();

    return () => {
      isMounted = false;
    };
  }, []);

  function toggleOrder(orderId: number) {
    setExpandedOrderIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(orderId)) {
        nextIds.delete(orderId);
      } else {
        nextIds.add(orderId);
      }

      return nextIds;
    });
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-4xl font-bold">Orders</h1>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Order ID</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Customer</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Date</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Status</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Total</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Items</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="px-6 py-8 text-center text-gray-500" colSpan={7}>
                    Loading orders...
                  </td>
                </tr>
              )}

              {!isLoading && orders.length === 0 && (
                <tr>
                  <td className="px-6 py-8 text-center text-gray-500" colSpan={7}>
                    No orders yet
                  </td>
                </tr>
              )}

              {!isLoading && orders.map((order) => {
                const isExpanded = expandedOrderIds.has(order.id);

                return (
                  <Fragment key={order.id}>
                    <tr className="border-b hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">#{order.id}</td>
                      <td className="px-6 py-3">
                        <p className="font-medium text-gray-900">{order.customer.name}</p>
                        <p className="text-sm text-gray-500">{order.customer.email}</p>
                      </td>
                      <td className="px-6 py-3 text-gray-700">{formatDate(order.createdAt)}</td>
                      <td className="px-6 py-3">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                          {formatStatus(order.status)}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-medium text-green-700">{formatPrice(order.totalAmount)}</td>
                      <td className="px-6 py-3 text-gray-700">{formatItemCount(order.items.length)}</td>
                      <td className="px-6 py-3">
                        <button
                          type="button"
                          onClick={() => toggleOrder(order.id)}
                          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                        >
                          {isExpanded ? 'Hide items' : 'Show items'}
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="border-b bg-gray-50">
                        <td className="px-6 py-4" colSpan={7}>
                          <div className="space-y-3">
                            {order.items.map((item) => (
                              <div
                                key={item.id}
                                className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-[1fr_auto_auto_auto]"
                              >
                                <div className="flex items-center gap-3">
                                  <img
                                    src={item.product.imageUrl}
                                    alt={item.product.name}
                                    className="h-12 w-12 rounded-md bg-gray-100 object-cover"
                                  />
                                  <div>
                                    <p className="font-medium text-gray-900">{item.product.name}</p>
                                    <p className="text-sm text-gray-500">{item.product.category.name}</p>
                                  </div>
                                </div>
                                <p className="text-sm text-gray-700">
                                  <span className="font-medium">Qty:</span> {item.quantity}
                                </p>
                                <p className="text-sm text-gray-700">
                                  <span className="font-medium">Unit:</span> {formatPrice(item.unitPrice)}
                                </p>
                                <p className="text-sm font-semibold text-green-700">
                                  {formatPrice(item.lineTotal)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
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

function formatStatus(status: AdminOrder['status']) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function formatItemCount(count: number) {
  return count === 1 ? '1 item' : `${count} items`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback;
  }

  return fallback;
}
