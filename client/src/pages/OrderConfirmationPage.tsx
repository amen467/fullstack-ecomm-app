export default function OrderConfirmationPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Order Confirmed! ✓</h1>
        <p className="text-xl text-gray-600 mb-4">Thank you for your purchase</p>
        <p className="text-2xl font-bold text-green-600">Order #12345</p>
      </div>

      <div className="bg-gray-50 p-6 rounded-lg mb-6">
        <h2 className="text-2xl font-bold mb-4">Order Details</h2>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Order Date:</span>
            <span>April 27, 2026</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Status:</span>
            <span className="text-blue-600 font-semibold">Processing</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Estimated Delivery:</span>
            <span>May 3, 2026</span>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 p-6 rounded-lg mb-6">
        <h2 className="text-2xl font-bold mb-4">Order Items</h2>
        <p className="text-gray-600">Your order items will appear here</p>
      </div>

      <div className="bg-blue-50 p-6 rounded-lg mb-6">
        <h2 className="text-2xl font-bold mb-4">Order Summary</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>$0.00</span>
          </div>
          <div className="flex justify-between">
            <span>Shipping:</span>
            <span>$0.00</span>
          </div>
          <div className="border-t pt-2 flex justify-between font-bold text-lg">
            <span>Total:</span>
            <span>$0.00</span>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700">
          View Order
        </button>
        <button className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-400">
          Continue Shopping
        </button>
      </div>
    </div>
  );
}
