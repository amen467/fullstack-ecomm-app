import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { cartAPI, productsAPI, type Product } from '../api/client';
import { setCart } from '../store/slices/cartSlice';
import type { AppDispatch, RootState } from '../store/store';

export default function ProductDetailPage() {
  const { id } = useParams();
  const dispatch = useDispatch<AppDispatch>();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const location = useLocation();
  const navigate = useNavigate();
  const productId = useMemo(() => parseProductId(id), [id]);
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(productId !== null);
  const [error, setError] = useState<string | null>(null);
  const [cartMessage, setCartMessage] = useState<CartMessage | null>(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  useEffect(() => {
    if (productId === null) {
      return;
    }

    let isMounted = true;
    const requestedProductId = productId;

    async function loadProduct() {
      setIsLoading(true);

      try {
        const response = await productsAPI.getById(requestedProductId);

        if (isMounted) {
          setProduct(response.data.product);
          setError(null);
        }
      } catch {
        if (isMounted) {
          setProduct(null);
          setError('We could not load this product. It may no longer be available.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadProduct();

    return () => {
      isMounted = false;
    };
  }, [productId]);

  if (productId === null) {
    return <ProductError message="That product link is not valid." />;
  }

  if (isLoading) {
    return <ProductDetailSkeleton />;
  }

  if (error || !product) {
    return <ProductError message={error ?? 'Product not found.'} />;
  }

  const inventoryLabel = product.inventoryCount > 0
    ? `${product.inventoryCount} in stock`
    : 'Out of stock';

  async function handleAddToCart() {
    if (!product) {
      return;
    }

    if (!isAuthenticated && !hasStoredToken()) {
      navigate('/login', { state: { from: location } });
      return;
    }

    setIsAddingToCart(true);
    setCartMessage(null);

    try {
      const response = await cartAPI.addItem({ productId: product.id, quantity: 1 });
      dispatch(setCart(response.data));
      setCartMessage({ type: 'success', text: 'Added to cart.' });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        navigate('/login', { state: { from: location } });
        return;
      }

      setCartMessage({ type: 'error', text: getErrorMessage(error, 'Unable to add this item to your cart.') });
    } finally {
      setIsAddingToCart(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to="/products" className="mb-6 inline-block text-sm font-medium text-blue-600 hover:text-blue-700">
        Back to products
      </Link>

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="overflow-hidden rounded-lg bg-gray-100 lg:w-1/2">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="aspect-square w-full object-cover"
          />
        </div>

        <div className="text-left lg:w-1/2">
          <p className="mb-3 text-sm font-medium text-blue-600">{product.category.name}</p>
          <h1 className="mb-4 text-3xl font-bold">{product.name}</h1>
          <p className="mb-4 text-2xl font-bold text-green-700">{formatPrice(product.price)}</p>
          <p className={product.inventoryCount > 0 ? 'mb-6 text-gray-600' : 'mb-6 font-medium text-red-600'}>
            {inventoryLabel}
          </p>
          <p className="mb-8 text-gray-700">{product.description}</p>
          <button
            type="button"
            onClick={() => void handleAddToCart()}
            disabled={product.inventoryCount === 0 || isAddingToCart}
            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isAddingToCart ? 'Adding...' : 'Add to Cart'}
          </button>
          {cartMessage && (
            <p className={cartMessage.type === 'success' ? 'mt-3 text-sm font-medium text-green-700' : 'mt-3 text-sm font-medium text-red-600'}>
              {cartMessage.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductDetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 h-5 w-28 animate-pulse rounded bg-gray-200" />
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="aspect-square animate-pulse rounded-lg bg-gray-200 lg:w-1/2" />
        <div className="lg:w-1/2">
          <div className="mb-3 h-4 w-28 animate-pulse rounded bg-gray-200" />
          <div className="mb-4 h-10 w-3/4 animate-pulse rounded bg-gray-200" />
          <div className="mb-4 h-8 w-24 animate-pulse rounded bg-gray-200" />
          <div className="mb-6 h-5 w-32 animate-pulse rounded bg-gray-200" />
          <div className="mb-3 h-5 w-full animate-pulse rounded bg-gray-200" />
          <div className="mb-8 h-5 w-2/3 animate-pulse rounded bg-gray-200" />
          <div className="h-12 w-32 animate-pulse rounded-lg bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

function ProductError({ message }: { message: string }) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-left">
        <h1 className="mb-3 text-3xl font-bold text-red-900">Product unavailable</h1>
        <p className="mb-6 text-red-700">{message}</p>
        <Link
          to="/products"
          className="inline-block rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
        >
          Back to products
        </Link>
      </div>
    </div>
  );
}

function parseProductId(id: string | undefined) {
  if (!id) {
    return null;
  }

  const productId = Number(id);

  return Number.isInteger(productId) && productId > 0 ? productId : null;
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

function hasStoredToken() {
  return Boolean(localStorage.getItem('token'));
}

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback;
  }

  return fallback;
}

type CartMessage = {
  type: 'success' | 'error';
  text: string;
};
