export default function ProductDetailPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex gap-8">
        {/* Product image */}
        <div className="w-1/2 bg-gray-200 h-96 rounded-lg flex items-center justify-center">
          <p className="text-gray-600 text-lg">Product Image</p>
        </div>
        
        {/* Product details */}
        <div className="w-1/2">
          <h1 className="text-3xl font-bold mb-4">Product Name</h1>
          <p className="text-2xl text-green-600 font-bold mb-4">$99.99</p>
          <p className="text-gray-600 mb-6">Product description coming soon...</p>
          <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700">
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
