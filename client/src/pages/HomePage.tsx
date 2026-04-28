export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-6">Welcome to E-Shop</h1>
      <p className="text-xl text-gray-600 mb-8">Discover our featured products</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Featured products placeholder */}
        <div className="bg-gray-200 p-4 rounded-lg h-64 flex items-center justify-center">
          <p className="text-gray-600">Featured Product 1</p>
        </div>
        <div className="bg-gray-200 p-4 rounded-lg h-64 flex items-center justify-center">
          <p className="text-gray-600">Featured Product 2</p>
        </div>
        <div className="bg-gray-200 p-4 rounded-lg h-64 flex items-center justify-center">
          <p className="text-gray-600">Featured Product 3</p>
        </div>
        <div className="bg-gray-200 p-4 rounded-lg h-64 flex items-center justify-center">
          <p className="text-gray-600">Featured Product 4</p>
        </div>
      </div>
    </div>
  );
}
