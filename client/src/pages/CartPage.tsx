import axios from 'axios';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cartAPI, type CartItem } from '../api/client';
import { setCart } from '../store/slices/cartSlice';
import type { AppDispatch, RootState } from '../store/store';

export default function CartPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { items, subtotal } = useSelector((state: RootState) => state.cart);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<number, string>>({});
  const [pendingItemId, setPendingItemId] = useState<number | null>(null);
  const hasItems = items.length > 0;

  useEffect(() => {
    if (!isAuthenticated && !hasStoredToken()) {
      navigate('/login', { state: { from: location }, replace: true });
      return;
    }

    let isMounted = true;

    async function loadCart() {
      setIsLoading(true);
      setPageError(null);

      try {
        const response = await cartAPI.getCart();

        if (isMounted) {
          dispatch(setCart(response.data));
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (axios.isAxiosError(error) && error.response?.status === 401) {
          navigate('/login', { state: { from: location }, replace: true });
          return;
        }

        setPageError(getErrorMessage(error, 'We could not load your cart. Please try again.'));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadCart();

    return () => {
      isMounted = false;
    };
  }, [dispatch, isAuthenticated, location, navigate]);

  async function handleQuantityChange(item: CartItem, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity === item.quantity) {
      return;
    }

    await runItemAction(item.id, async () => {
      const response = await cartAPI.updateItem(item.id, { quantity });
      dispatch(setCart(response.data));
    });
  }

  async function handleRemoveItem(item: CartItem) {
    await runItemAction(item.id, async () => {
      const response = await cartAPI.removeItem(item.id);
      dispatch(setCart(response.data));
    });
  }

  async function runItemAction(itemId: number, action: () => Promise<void>) {
    setPendingItemId(itemId);
    setItemErrors((currentErrors) => omitItemError(currentErrors, itemId));

    try {
      await action();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        navigate('/login', { state: { from: location }, replace: true });
        return;
      }

      setItemErrors((currentErrors) => ({
        ...currentErrors,
        [itemId]: getErrorMessage(error, 'Unable to update this item.'),
      }));
    } finally {
      setPendingItemId(null);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-4xl font-bold">Shopping Cart</h1>
      <div className="flex flex-col gap-8 lg:flex-row">
        <main className="flex-1">
          {isLoading && (
            <div className="rounded-lg bg-gray-100 p-6">
              <p className="text-lg text-gray-600">Loading your cart...</p>
            </div>
          )}

          {!isLoading && pageError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6">
              <p className="font-medium text-red-700">{pageError}</p>
            </div>
          )}

          {!isLoading && !pageError && !hasItems && (
            <div className="rounded-lg bg-gray-100 p-6">
              <p className="mb-4 text-lg text-gray-600">Your cart is empty</p>
              <Link
                to="/products"
                className="inline-block rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
              >
                Browse products
              </Link>
            </div>
          )}

          {!isLoading && !pageError && hasItems && (
            <div className="space-y-4">
              {items.map((item) => (
                <CartItemRow
                  key={item.id}
                  item={item}
                  error={itemErrors[item.id] ?? null}
                  isPending={pendingItemId === item.id}
                  onQuantityChange={handleQuantityChange}
                  onRemove={handleRemoveItem}
                />
              ))}
            </div>
          )}
        </main>

        <aside className="w-full lg:w-80">
          <div className="sticky top-20 rounded-lg bg-gray-100 p-6">
            <h2 className="mb-4 text-2xl font-bold">Order Summary</h2>
            <div className="mb-4 space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping:</span>
                <span>$0.00</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-lg font-bold">
                <span>Total:</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
            </div>
            {hasItems && (
              <Link
                to="/checkout"
                className="block w-full rounded-lg bg-green-600 py-3 text-center font-semibold text-white hover:bg-green-700"
              >
                Proceed to Checkout
              </Link>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function CartItemRow({
  item,
  error,
  isPending,
  onQuantityChange,
  onRemove,
}: {
  item: CartItem;
  error: string | null;
  isPending: boolean;
  onQuantityChange: (item: CartItem, quantity: number) => Promise<void>;
  onRemove: (item: CartItem) => Promise<void>;
}) {
  const canDecrement = item.quantity > 1;
  const canIncrement = item.quantity < item.product.inventoryCount;

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row">
        <Link to={`/products/${item.productId}`} className="shrink-0 overflow-hidden rounded-md bg-gray-100 sm:w-28">
          <img
            src={item.product.imageUrl}
            alt={item.product.name}
            className="aspect-square w-full object-cover"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <p className="mb-1 text-sm font-medium text-blue-600">{item.product.category.name}</p>
          <h2 className="text-xl font-semibold text-gray-900">
            <Link to={`/products/${item.productId}`} className="hover:text-blue-600">
              {item.product.name}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-gray-600">{formatPrice(item.product.price)} each</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center overflow-hidden rounded-lg border border-gray-300 bg-white">
              <button
                type="button"
                onClick={() => void onQuantityChange(item, item.quantity - 1)}
                disabled={!canDecrement || isPending}
                className="h-10 w-10 font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
                aria-label={`Decrease quantity for ${item.product.name}`}
              >
                -
              </button>
              <input
                type="number"
                min={1}
                max={item.product.inventoryCount}
                value={item.quantity}
                onChange={(event) => void onQuantityChange(item, Number(event.target.value))}
                disabled={isPending}
                className="h-10 w-16 border-x border-gray-300 text-center text-sm font-semibold outline-none disabled:bg-gray-100"
                aria-label={`Quantity for ${item.product.name}`}
              />
              <button
                type="button"
                onClick={() => void onQuantityChange(item, item.quantity + 1)}
                disabled={!canIncrement || isPending}
                className="h-10 w-10 font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
                aria-label={`Increase quantity for ${item.product.name}`}
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={() => void onRemove(item)}
              disabled={isPending}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
            >
              {isPending ? 'Updating...' : 'Remove'}
            </button>
          </div>

          {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
        </div>

        <div className="text-left sm:w-28 sm:text-right">
          <p className="text-sm text-gray-500">Line total</p>
          <p className="text-lg font-bold text-gray-900">{formatPrice(item.lineTotal)}</p>
        </div>
      </div>
    </article>
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

function omitItemError(errors: Record<number, string>, itemId: number) {
  const remainingErrors = { ...errors };
  delete remainingErrors[itemId];

  return remainingErrors;
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
