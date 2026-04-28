export default function ProductListPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-6">Products</h1>
      <div className="flex gap-8">
        {/* Sidebar filters */}
        <aside className="w-64">
          <div className="bg-gray-100 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Filters</h2>
            <p className="text-gray-600">Filter options coming soon...</p>
          </div>
        </aside>
        
        {/* Product grid */}
        <main className="flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Product card placeholders */}
            {[1, 2, 3, 4, 5, 6].map((id) => (
              <div key={id} className="bg-gray-200 p-4 rounded-lg h-80 flex items-center justify-center">
                <p className="text-gray-600">Product {id}</p>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
