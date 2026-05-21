import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { productsAPI, type Product } from '../api/client';

export default function ProductListPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const retryLoadProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await productsAPI.getAll();
      setProducts(response.data.products);
    } catch {
      setError('We could not load products right now. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      try {
        const response = await productsAPI.getAll();

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
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-4xl font-bold">Products</h1>
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Sidebar filters */}
        <aside className="lg:w-64">
          <div className="bg-gray-100 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Filters</h2>
            <p className="text-gray-600">Filter options coming soon...</p>
          </div>
        </aside>

        {/* Product grid */}
        <main className="flex-1">
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
              <h2 className="mb-2 text-2xl font-semibold text-gray-900">No products found</h2>
              <p className="text-gray-600">The catalog is empty right now.</p>
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

function ProductCard({ product }: { product: Product }) {
  const inventoryLabel = product.inventoryCount > 0
    ? `${product.inventoryCount} in stock`
    : 'Out of stock';

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
