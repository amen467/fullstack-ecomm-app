export default function CartPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-6">Shopping Cart</h1>
      <div className="flex gap-8">
        {/* Cart items */}
        <main className="flex-1">
          <div className="bg-gray-100 p-6 rounded-lg">
            <p className="text-gray-600 text-lg">Your cart is empty</p>
          </div>
        </main>
        
        {/* Cart summary */}
        <aside className="w-80">
          <div className="bg-gray-100 p-6 rounded-lg sticky top-20">
            <h2 className="text-2xl font-bold mb-4">Order Summary</h2>
            <div className="space-y-2 mb-4">
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
            <button className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700">
              Proceed to Checkout
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
