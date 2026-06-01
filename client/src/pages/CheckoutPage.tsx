import axios from 'axios';
import { type FormEvent, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cartAPI, ordersAPI, type CreateOrderRequest } from '../api/client';
import { clearCart, setCart } from '../store/slices/cartSlice';
import type { AppDispatch, RootState } from '../store/store';

const initialFormState: CreateOrderRequest = {
  shipping: {
    fullName: '',
    address: '',
    city: '',
    zipCode: '',
  },
  payment: {
    cardNumber: '',
    expiry: '',
    cvc: '',
  },
};

export default function CheckoutPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { items, subtotal } = useSelector((state: RootState) => state.cart);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const location = useLocation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<CreateOrderRequest>(initialFormState);
  const [isLoadingCart, setIsLoadingCart] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const hasItems = items.length > 0;

  useEffect(() => {
    if (!isAuthenticated && !hasStoredToken()) {
      navigate('/login', { state: { from: location }, replace: true });
      return;
    }

    let isMounted = true;

    async function loadCart() {
      setIsLoadingCart(true);
      setFormError(null);

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

        setFormError(getErrorMessage(error, 'We could not load your cart. Please try again.'));
      } finally {
        if (isMounted) {
          setIsLoadingCart(false);
        }
      }
    }

    void loadCart();

    return () => {
      isMounted = false;
    };
  }, [dispatch, isAuthenticated, location, navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!hasItems) {
      setFormError('Your cart is empty.');
      return;
    }

    const payload = buildPayload(formData);
    const validationError = validateCheckoutForm(payload);

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await ordersAPI.create(payload);
      dispatch(clearCart());
      navigate(`/orders/${response.data.order.id}`, { replace: true });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        navigate('/login', { state: { from: location }, replace: true });
        return;
      }

      setFormError(getErrorMessage(error, 'Unable to submit checkout.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateShippingField(field: keyof CreateOrderRequest['shipping'], value: string) {
    setFormData((currentFormData) => ({
      ...currentFormData,
      shipping: {
        ...currentFormData.shipping,
        [field]: value,
      },
    }));
  }

  function updatePaymentField(field: keyof CreateOrderRequest['payment'], value: string) {
    setFormData((currentFormData) => ({
      ...currentFormData,
      payment: {
        ...currentFormData.payment,
        [field]: value,
      },
    }));
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-8 text-4xl font-bold">Checkout</h1>

      {isLoadingCart && (
        <div className="rounded-lg bg-gray-100 p-6">
          <p className="text-lg text-gray-600">Loading checkout...</p>
        </div>
      )}

      {!isLoadingCart && !hasItems && (
        <div className="rounded-lg bg-gray-100 p-6">
          <p className="mb-4 text-lg text-gray-600">Your cart is empty.</p>
          <Link
            to="/products"
            className="inline-block rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
          >
            Browse products
          </Link>
        </div>
      )}

      {!isLoadingCart && hasItems && (
        <form className="space-y-6" onSubmit={handleSubmit}>
          {formError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </p>
          )}

          <section className="rounded-lg bg-gray-50 p-6">
            <h2 className="mb-4 text-2xl font-bold">Shipping Information</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="fullName" className="mb-2 block text-sm font-medium">
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={formData.shipping.fullName}
                  onChange={(event) => updateShippingField('fullName', event.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label htmlFor="address" className="mb-2 block text-sm font-medium">
                  Address
                </label>
                <input
                  id="address"
                  type="text"
                  value={formData.shipping.address}
                  onChange={(event) => updateShippingField('address', event.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123 Main St"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="city" className="mb-2 block text-sm font-medium">
                    City
                  </label>
                  <input
                    id="city"
                    type="text"
                    value={formData.shipping.city}
                    onChange={(event) => updateShippingField('city', event.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="New York"
                  />
                </div>
                <div>
                  <label htmlFor="zipCode" className="mb-2 block text-sm font-medium">
                    ZIP Code
                  </label>
                  <input
                    id="zipCode"
                    type="text"
                    inputMode="numeric"
                    value={formData.shipping.zipCode}
                    onChange={(event) => updateShippingField('zipCode', event.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="10001"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg bg-gray-50 p-6">
            <h2 className="mb-4 text-2xl font-bold">Payment Information (Mock)</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="cardNumber" className="mb-2 block text-sm font-medium">
                  Card Number
                </label>
                <input
                  id="cardNumber"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={formData.payment.cardNumber}
                  onChange={(event) => updatePaymentField('cardNumber', event.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="4111 1111 1111 1111"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="expiry" className="mb-2 block text-sm font-medium">
                    Expiry
                  </label>
                  <input
                    id="expiry"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={formData.payment.expiry}
                    onChange={(event) => updatePaymentField('expiry', event.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="12/30"
                  />
                </div>
                <div>
                  <label htmlFor="cvc" className="mb-2 block text-sm font-medium">
                    CVC
                  </label>
                  <input
                    id="cvc"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={formData.payment.cvc}
                    onChange={(event) => updatePaymentField('cvc', event.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="123"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg bg-blue-50 p-6">
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
          </section>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-green-600 py-3 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
          >
            {isSubmitting ? 'Submitting...' : 'Complete Purchase'}
          </button>
        </form>
      )}
    </div>
  );
}

function buildPayload(formData: CreateOrderRequest): CreateOrderRequest {
  return {
    shipping: {
      fullName: formData.shipping.fullName.trim(),
      address: formData.shipping.address.trim(),
      city: formData.shipping.city.trim(),
      zipCode: formData.shipping.zipCode.trim(),
    },
    payment: {
      cardNumber: formData.payment.cardNumber.trim(),
      expiry: formData.payment.expiry.trim(),
      cvc: formData.payment.cvc.trim(),
    },
  };
}

function validateCheckoutForm(formData: CreateOrderRequest) {
  if (!formData.shipping.fullName) {
    return 'Full name is required';
  }

  if (!formData.shipping.address) {
    return 'Address is required';
  }

  if (!formData.shipping.city) {
    return 'City is required';
  }

  if (!/^\d{5}$/.test(formData.shipping.zipCode)) {
    return 'ZIP code must be 5 digits';
  }

  if (!formData.payment.cardNumber) {
    return 'Card number is required';
  }

  if (!/^[\d ]+$/.test(formData.payment.cardNumber)) {
    return 'Card number can only contain digits and spaces';
  }

  const cardDigits = formData.payment.cardNumber.replaceAll(' ', '');

  if (cardDigits.length < 13 || cardDigits.length > 19) {
    return 'Card number must contain 13 to 19 digits';
  }

  if (!formData.payment.expiry) {
    return 'Expiry is required';
  }

  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(formData.payment.expiry)) {
    return 'Expiry must use MM/YY format';
  }

  if (!formData.payment.cvc) {
    return 'CVC is required';
  }

  if (!/^\d{3,4}$/.test(formData.payment.cvc)) {
    return 'CVC must be 3 or 4 digits';
  }

  return null;
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
