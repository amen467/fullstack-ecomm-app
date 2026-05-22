import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { cartAPI, productsAPI, type Product, type ProductCategory } from '../api/client';
import { setCart } from '../store/slices/cartSlice';
import type { AppDispatch, RootState } from '../store/store';

export default function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<ProductCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categoryFilter = searchParams.get('category')?.trim() ?? '';
  const searchFilter = searchParams.get('search')?.trim() ?? '';
  const hasActiveFilters = categoryFilter.length > 0 || searchFilter.length > 0;

  const activeCategoryName = useMemo(() => {
    return categoryOptions.find((category) => category.slug === categoryFilter)?.name ?? categoryFilter;
  }, [categoryFilter, categoryOptions]);

  const retryLoadProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await productsAPI.getAll(buildProductQuery(categoryFilter, searchFilter));
      setProducts(response.data.products);
    } catch {
      setError('We could not load products right now. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter, searchFilter]);

  useEffect(() => {
    let isMounted = true;

    async function loadCategories() {
      try {
        const response = await productsAPI.getAll();

        if (isMounted) {
          setCategoryOptions(extractCategories(response.data.products));
        }
      } catch {
        if (isMounted) {
          setCategoryOptions([]);
        }
      }
    }

    void loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await productsAPI.getAll(buildProductQuery(categoryFilter, searchFilter));

        if (isMounted) {
          setProducts(response.data.products);
        }
      } catch {
        if (isMounted) {
          setError('We could not load products right now. Please try again.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadProducts();

    return () => {
      isMounted = false;
    };
  }, [categoryFilter, searchFilter]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const submittedSearch = String(formData.get('search') ?? '').trim();

    updateFilters({ search: submittedSearch });
  }

  function handleCategoryChange(categorySlug: string) {
    updateFilters({ category: categorySlug });
  }

  function handleClearFilters() {
    setSearchParams({});
  }

  function updateFilters(updates: { category?: string; search?: string }) {
    const nextParams = new URLSearchParams(searchParams);

    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        nextParams.set(key, value);
      } else {
        nextParams.delete(key);
      }
    }

    setSearchParams(nextParams);
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-4xl font-bold">Products</h1>
      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="lg:w-64">
          <div className="rounded-lg bg-gray-100 p-4">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-gray-900">Filters</h2>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Clear
                </button>
              )}
            </div>

            <form onSubmit={handleSearchSubmit} className="mb-6">
              <label htmlFor="product-search" className="mb-2 block text-sm font-medium text-gray-700">
                Search
              </label>
              <div className="flex gap-2">
                <input
                  key={searchFilter}
                  id="product-search"
                  name="search"
                  type="search"
                  defaultValue={searchFilter}
                  placeholder="Search products"
                  className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
                <button
                  type="submit"
                  className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Go
                </button>
              </div>
            </form>

            <fieldset>
              <legend className="mb-3 text-sm font-medium text-gray-700">Category</legend>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="category"
                    checked={categoryFilter === ''}
                    onChange={() => handleCategoryChange('')}
                    className="h-4 w-4 text-blue-600"
                  />
                  All categories
                </label>

                {categoryOptions.map((category) => (
                  <label key={category.id} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="category"
                      checked={categoryFilter === category.slug}
                      onChange={() => handleCategoryChange(category.slug)}
                      className="h-4 w-4 text-blue-600"
                    />
                    {category.name}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </aside>

        <main className="flex-1">
          {hasActiveFilters && (
            <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
              Showing products
              {categoryFilter && <> in <span className="font-semibold">{activeCategoryName}</span></>}
              {searchFilter && <> matching <span className="font-semibold">"{searchFilter}"</span></>}
            </div>
          )}

          {isLoading && <ProductGridSkeleton />}

          {!isLoading && error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-left">
              <p className="mb-4 font-medium text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => void retryLoadProducts()}
                className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {!isLoading && !error && products.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
              <h2 className="mb-2 text-2xl font-semibold text-gray-900">
                {hasActiveFilters ? 'No matching products' : 'No products found'}
              </h2>
              <p className="text-gray-600">
                {hasActiveFilters
                  ? 'Try a different search or category filter.'
                  : 'The catalog is empty right now.'}
              </p>
            </div>
          )}

          {!isLoading && !error && products.length > 0 && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((id) => (
        <div key={id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 aspect-square animate-pulse rounded-md bg-gray-200" />
          <div className="mb-3 h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="mb-3 h-6 w-3/4 animate-pulse rounded bg-gray-200" />
          <div className="mb-4 h-4 w-full animate-pulse rounded bg-gray-200" />
          <div className="h-5 w-20 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

function buildProductQuery(category: string, search: string) {
  return {
    ...(category ? { category } : {}),
    ...(search ? { search } : {}),
  };
}

function extractCategories(products: Product[]) {
  const categories = new Map<string, ProductCategory>();

  for (const product of products) {
    categories.set(product.category.slug, product.category);
  }

  return [...categories.values()].sort((first, second) => first.name.localeCompare(second.name));
}

function ProductCard({ product }: { product: Product }) {
  const dispatch = useDispatch<AppDispatch>();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const location = useLocation();
  const navigate = useNavigate();
  const [cartMessage, setCartMessage] = useState<CartMessage | null>(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const inventoryLabel = product.inventoryCount > 0
    ? `${product.inventoryCount} in stock`
    : 'Out of stock';

  async function handleAddToCart() {
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

      setCartMessage({ type: 'error', text: getErrorMessage(error, 'Unable to add item.') });
    } finally {
      setIsAddingToCart(false);
    }
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link to={`/products/${product.id}`} className="block bg-gray-100">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="aspect-square w-full object-cover"
          loading="lazy"
        />
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="mb-2 text-sm font-medium text-blue-600">{product.category.name}</p>
        <h2 className="mb-2 text-xl font-semibold text-gray-900">
          <Link to={`/products/${product.id}`} className="hover:text-blue-600">
            {product.name}
          </Link>
        </h2>
        <p className="mb-4 line-clamp-2 flex-1 text-sm text-gray-600">{product.description}</p>
        <div className="flex items-center justify-between gap-4">
          <p className="text-lg font-bold text-green-700">{formatPrice(product.price)}</p>
          <p className={product.inventoryCount > 0 ? 'text-sm text-gray-500' : 'text-sm font-medium text-red-600'}>
            {inventoryLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleAddToCart()}
          disabled={product.inventoryCount === 0 || isAddingToCart}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {isAddingToCart ? 'Adding...' : 'Add to Cart'}
        </button>
        {cartMessage && (
          <p className={cartMessage.type === 'success' ? 'mt-2 text-sm font-medium text-green-700' : 'mt-2 text-sm font-medium text-red-600'}>
            {cartMessage.text}
          </p>
        )}
      </div>
    </article>
  );
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
