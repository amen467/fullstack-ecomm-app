import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Admin Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Stats cards */}
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
          <p className="text-gray-600 text-sm">Total Products</p>
          <p className="text-3xl font-bold mt-2">0</p>
        </div>
        <div className="bg-green-50 p-6 rounded-lg border border-green-200">
          <p className="text-gray-600 text-sm">Total Orders</p>
          <p className="text-3xl font-bold mt-2">0</p>
        </div>
        <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
          <p className="text-gray-600 text-sm">Total Revenue</p>
          <p className="text-3xl font-bold mt-2">$0.00</p>
        </div>
      </div>

      {/* Admin actions */}
      <div className="bg-gray-50 p-6 rounded-lg">
        <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/admin/products"
            className="block bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-lg transition"
          >
            <h3 className="font-semibold text-lg">Manage Products</h3>
            <p className="text-gray-600 text-sm mt-1">Add, edit, or delete products</p>
          </Link>
          <Link
            to="/admin/orders"
            className="block bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-lg transition"
          >
            <h3 className="font-semibold text-lg">View Orders</h3>
            <p className="text-gray-600 text-sm mt-1">Manage customer orders</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
