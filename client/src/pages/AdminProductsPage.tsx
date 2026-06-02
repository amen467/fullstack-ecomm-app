import axios from 'axios';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { productsAPI, type Product, type ProductCategory, type ProductFormRequest } from '../api/client';

type ProductFormState = {
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  inventoryCount: string;
  categoryId: string;
};

const emptyForm: ProductFormState = {
  name: '',
  description: '',
  price: '',
  imageUrl: '',
  inventoryCount: '0',
  categoryId: '',
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const categoryOptions = useMemo(() => extractCategories(products), [products]);
  const isEditing = editingProduct !== null;

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await productsAPI.getAll();

        if (isMounted) {
          setProducts(response.data.products);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(getErrorMessage(loadError, 'Unable to load products.'));
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

  function handleAddProduct() {
    setEditingProduct(null);
    setIsFormOpen(true);
    setForm({
      ...emptyForm,
      categoryId: categoryOptions[0]?.id.toString() ?? '',
    });
    setFormError(null);
    setStatusMessage(null);
  }

  function handleEditProduct(product: Product) {
    setEditingProduct(product);
    setIsFormOpen(true);
    setForm({
      name: product.name,
      description: product.description,
      price: product.price,
      imageUrl: product.imageUrl,
      inventoryCount: product.inventoryCount.toString(),
      categoryId: product.category.id.toString(),
    });
    setFormError(null);
    setStatusMessage(null);
  }

  function handleCancelEdit() {
    setEditingProduct(null);
    setIsFormOpen(false);
    setForm(emptyForm);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setStatusMessage(null);

    const payload = buildProductPayload(form);

    if (!payload) {
      setFormError('Fill out all product fields with valid values.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = isEditing
        ? await productsAPI.update(editingProduct.id, payload)
        : await productsAPI.create(payload);

      setProducts((currentProducts) => {
        if (isEditing) {
          return currentProducts.map((product) => (
            product.id === response.data.product.id ? response.data.product : product
          ));
        }

        return [...currentProducts, response.data.product].sort((first, second) => first.id - second.id);
      });

      setEditingProduct(null);
      setIsFormOpen(false);
      setForm(emptyForm);
      setStatusMessage(isEditing ? 'Product updated.' : 'Product created.');
    } catch (submitError) {
      setFormError(getErrorMessage(submitError, isEditing ? 'Unable to update product.' : 'Unable to create product.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteProduct(product: Product) {
    const confirmed = window.confirm(`Delete ${product.name}?`);

    if (!confirmed) {
      return;
    }

    setDeletingProductId(product.id);
    setStatusMessage(null);
    setError(null);

    try {
      await productsAPI.delete(product.id);
      setProducts((currentProducts) => currentProducts.filter((currentProduct) => currentProduct.id !== product.id));

      if (editingProduct?.id === product.id) {
        handleCancelEdit();
      }

      setStatusMessage('Product deleted.');
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Unable to delete product.'));
    } finally {
      setDeletingProductId(null);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-4xl font-bold">Manage Products</h1>
        <button
          type="button"
          onClick={handleAddProduct}
          className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700"
        >
          Add Product
        </button>
      </div>

      {isFormOpen && (
        <section className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-bold">{isEditing ? 'Edit Product' : 'Add Product'}</h2>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-left text-sm font-medium text-gray-600 hover:text-gray-900 sm:text-right"
            >
              Cancel
            </button>
          </div>

          {formError && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </p>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Name</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Category</span>
              <select
                value={form.categoryId}
                onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a category</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Price</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Inventory</span>
              <input
                type="number"
                min="0"
                step="1"
                value={form.inventoryCount}
                onChange={(event) => setForm({ ...form, inventoryCount: event.target.value })}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-gray-700">Image URL</span>
              <input
                type="url"
                value={form.imageUrl}
                onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-gray-700">Description</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                required
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <div className="flex gap-3 md:col-span-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Product'}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="rounded-lg border border-gray-300 bg-white px-6 py-2 font-semibold text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {statusMessage && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {statusMessage}
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Name</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Category</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Price</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Stock</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="px-6 py-8 text-center text-gray-500" colSpan={5}>
                    Loading products...
                  </td>
                </tr>
              )}

              {!isLoading && products.length === 0 && (
                <tr>
                  <td className="px-6 py-8 text-center text-gray-500" colSpan={5}>
                    No products yet. Add your first product to get started.
                  </td>
                </tr>
              )}

              {!isLoading && products.map((product) => (
                <tr key={product.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-12 w-12 rounded-md bg-gray-100 object-cover"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="line-clamp-1 max-w-xs text-sm text-gray-500">{product.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-gray-700">{product.category.name}</td>
                  <td className="px-6 py-3 font-medium text-green-700">{formatPrice(product.price)}</td>
                  <td className="px-6 py-3 text-gray-700">{product.inventoryCount}</td>
                  <td className="px-6 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditProduct(product)}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteProduct(product)}
                        disabled={deletingProductId === product.id}
                        className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                      >
                        {deletingProductId === product.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function buildProductPayload(form: ProductFormState): ProductFormRequest | null {
  const name = form.name.trim();
  const description = form.description.trim();
  const price = form.price.trim();
  const imageUrl = form.imageUrl.trim();
  const priceValue = Number(price);
  const inventoryCount = Number(form.inventoryCount);
  const categoryId = Number(form.categoryId);

  if (
    !name ||
    !description ||
    !price ||
    !imageUrl ||
    !Number.isFinite(priceValue) ||
    priceValue <= 0 ||
    !Number.isInteger(inventoryCount) ||
    inventoryCount < 0 ||
    !Number.isInteger(categoryId) ||
    categoryId <= 0
  ) {
    return null;
  }

  return {
    name,
    description,
    price,
    imageUrl,
    inventoryCount,
    categoryId,
  };
}

function extractCategories(products: Product[]) {
  const categories = new Map<number, ProductCategory>();

  for (const product of products) {
    categories.set(product.category.id, product.category);
  }

  return [...categories.values()].sort((first, second) => first.name.localeCompare(second.name));
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

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback;
  }

  return fallback;
}
