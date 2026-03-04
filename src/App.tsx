/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, 
  LayoutGrid, 
  ShoppingBag, 
  Wallet, 
  User as UserIcon, 
  Plus, 
  MapPin, 
  Search,
  ChevronRight,
  Minus,
  Trash2,
  CheckCircle2,
  Clock,
  Package,
  Truck,
  ArrowRight,
  LogOut,
  Settings,
  ShieldCheck,
  Bell,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Product, CartItem, Order, Seller } from './types';
import { io, Socket } from 'socket.io-client';

// --- Views ---

const OrdersView = ({ user, activeTab }: { user: User | null, activeTab: string }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  
  useEffect(() => {
    if (user) {
      const endpoint = user.role === 'seller' ? `/api/orders/seller/${user.sellerInfo?.id}` : `/api/orders/customer/${user.id}`;
      fetch(endpoint).then(res => res.json()).then(data => setOrders(Array.isArray(data) ? data : []));
    }
  }, [user, activeTab]);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return 'bg-amber-100 text-amber-600';
      case 'accepted': return 'bg-blue-100 text-blue-600';
      case 'out_for_delivery': return 'bg-indigo-100 text-indigo-600';
      case 'delivered': return 'bg-emerald-100 text-emerald-600';
      case 'rejected': return 'bg-red-100 text-red-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const updateStatus = async (orderId: string, status: string) => {
    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      // Refresh
      const endpoint = user?.role === 'seller' ? `/api/orders/seller/${user.sellerInfo?.id}` : `/api/orders/customer/${user?.id}`;
      const res = await fetch(endpoint);
      setOrders(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      <header className="p-6 bg-white border-b border-slate-100">
        <h2 className="text-xl font-bold font-display">My Orders</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 pb-24">
        {!user ? (
          <div className="text-center py-12">
            <p className="text-slate-500 mb-4">Please login to view orders</p>
            <div className="flex justify-center">
              <p className="text-sm text-slate-400 italic">Go to Account tab to login</p>
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="mx-auto text-slate-300 mb-2" size={40} />
            <p className="text-slate-500">No orders yet</p>
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Order #{order.id}</p>
                  <p className="text-xs text-slate-500">{new Date(order.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(order.status)}`}>
                  {order.status?.replace(/_/g, ' ') || 'Pending'}
                </span>
              </div>

              {order.items && order.items.length > 0 && (
                <div className="mb-4 space-y-2">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl">
                      <img 
                        src={item.image_url || 'https://picsum.photos/seed/product/100/100'} 
                        alt={item.name} 
                        className="w-10 h-10 rounded-lg object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{item.name}</p>
                        <p className="text-[10px] text-slate-400">Qty: {item.quantity} • ₹{item.price}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">₹{order.total_amount}</span>
                  {user.role === 'seller' && (
                    <span className="text-[10px] text-slate-400 font-medium">
                      (Platform Fee: ₹{order.platform_fee})
                    </span>
                  )}
                </div>
                
                {user.role === 'seller' && (
                  <div className="flex gap-2">
                    {order.status === 'pending' && (
                      <>
                        <button onClick={() => updateStatus(order.id, 'accepted')} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg">Accept</button>
                        <button onClick={() => updateStatus(order.id, 'rejected')} className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg">Reject</button>
                      </>
                    )}
                    {order.status === 'accepted' && (
                      <button onClick={() => updateStatus(order.id, 'out_for_delivery')} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg">Out for Delivery</button>
                    )}
                    {order.status === 'out_for_delivery' && (
                      <button onClick={() => updateStatus(order.id, 'delivered')} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg">Mark Delivered</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const WalletView = ({ user, activeTab }: { user: User | null, activeTab: string }) => {
  const [wallet, setWallet] = useState<any>(null);
  
  useEffect(() => {
    if (user) {
      fetch(`/api/wallet/${user.id}`).then(res => res.json()).then(setWallet);
    }
  }, [user, activeTab]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      <header className="p-6 bg-white border-b border-slate-100">
        <h2 className="text-xl font-bold font-display">My Wallet</h2>
      </header>

      <div className="p-6 space-y-6 flex-1 overflow-y-auto pb-24">
        {!user ? (
          <div className="text-center py-12">
            <p className="text-slate-500 mb-4">Please login to view wallet</p>
            <div className="flex justify-center">
              <p className="text-sm text-slate-400 italic">Go to Account tab to login</p>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-emerald-600 rounded-3xl p-8 text-white shadow-xl shadow-emerald-200 relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-emerald-100 text-sm font-medium mb-1">Available Balance</p>
                <h3 className="text-4xl font-bold mb-6">₹{wallet?.balance || '0.00'}</h3>
                <div className="flex gap-4">
                  <button className="flex-1 bg-white/20 backdrop-blur-md py-3 rounded-xl text-sm font-bold hover:bg-white/30 transition-all">Withdraw</button>
                  <button className="flex-1 bg-white text-emerald-600 py-3 rounded-xl text-sm font-bold hover:bg-emerald-50 transition-all">Add Money</button>
                </div>
              </div>
              <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-emerald-500 rounded-full opacity-30"></div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Recent Transactions</h4>
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white p-4 rounded-2xl flex items-center justify-between shadow-sm border border-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                        <Plus size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Order Payment</p>
                        <p className="text-[10px] text-slate-400">Mar 01, 2026</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">+₹150.00</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const SellerDashboardView = ({ user, activeTab, setActiveTab, logout }: { user: User | null, activeTab: string, setActiveTab: (tab: string) => void, logout: () => void }) => {
  const [stats, setStats] = useState({ orders: 0, products: 0, earnings: 0 });
  
  useEffect(() => {
    // Mock stats for now
    setStats({ orders: 12, products: 8, earnings: 2450 });
  }, [activeTab]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      <header className="p-6 bg-white border-b border-slate-100 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold font-display">Seller Dashboard</h2>
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-400">{user?.sellerInfo?.shop_name}</p>
            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${user?.sellerInfo?.approved ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
              {user?.sellerInfo?.approved ? 'Approved' : 'Pending Approval'}
            </span>
          </div>
        </div>
        <button onClick={logout} className="p-2 text-slate-400 hover:text-red-500"><LogOut size={20} /></button>
      </header>

      <div className="p-6 space-y-6 flex-1 overflow-y-auto pb-24">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-xs text-slate-400 font-medium mb-1">Total Orders</p>
            <h3 className="text-2xl font-bold text-emerald-600">{stats.orders}</h3>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-xs text-slate-400 font-medium mb-1">Total Earnings</p>
            <h3 className="text-2xl font-bold text-emerald-600">₹{stats.earnings}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold">Recent Orders</h4>
            <button onClick={() => setActiveTab('orders')} className="text-emerald-600 text-xs font-medium">View All</button>
          </div>
          <p className="text-slate-400 text-sm text-center py-4">New orders will appear here</p>
        </div>

        <button onClick={() => setActiveTab('seller-products')} className="btn-primary w-full flex items-center justify-center gap-2">
          <Plus size={20} /> Add New Product
        </button>
      </div>
    </div>
  );
};

const SellerProductsView = ({ user, activeTab }: { user: User | null, activeTab: string }) => {
  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    category: 'Grocery',
    image_url: ''
  });

  useEffect(() => {
    if (user?.sellerInfo) {
      // Fetch seller's products
      fetch(`/api/products/seller/${user.sellerInfo.id}`).then(res => res.json()).then(data => setSellerProducts(Array.isArray(data) ? data : []));
    }
  }, [user, activeTab, showAdd]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newProduct, seller_id: user?.sellerInfo?.id, price: parseFloat(newProduct.price) })
      });
      if (res.ok) {
        setShowAdd(false);
        setNewProduct({ name: '', description: '', price: '', category: 'Grocery', image_url: '' });
      }
    } catch (err) {
      alert("Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'available' ? 'out_of_stock' : 'available';
    await fetch(`/api/products/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    fetch(`/api/products/seller/${user?.sellerInfo?.id}`).then(res => res.json()).then(data => setSellerProducts(Array.isArray(data) ? data : []));
  };

  const deleteProduct = async (id: string) => {
    if (confirm("Are you sure you want to delete this product?")) {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      fetch(`/api/products/seller/${user?.sellerInfo?.id}`).then(res => res.json()).then(data => setSellerProducts(Array.isArray(data) ? data : []));
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      <header className="p-6 bg-white border-b border-slate-100 flex justify-between items-center">
        <h2 className="text-xl font-bold font-display">My Products</h2>
        <button onClick={() => setShowAdd(true)} className="p-2 bg-emerald-600 text-white rounded-xl"><Plus size={20} /></button>
      </header>

      <div className="p-6 space-y-4 flex-1 overflow-y-auto pb-24">
        {sellerProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="mx-auto text-slate-300 mb-2" size={40} />
            <p className="text-slate-500">No products added yet</p>
          </div>
        ) : (
          sellerProducts.map(product => (
            <div key={product.id} className="bg-white p-4 rounded-2xl flex gap-4 shadow-sm border border-slate-50">
              <img src={product.image_url || `https://picsum.photos/seed/${product.id}/200/200`} className="w-16 h-16 rounded-xl object-cover" referrerPolicy="no-referrer" />
              <div className="flex-1">
                <h4 className="font-semibold text-sm">{product.name}</h4>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">₹{product.price}</span>
                  <button 
                    onClick={() => toggleStatus(product.id, product.status)}
                    className={`text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase ${product.status === 'available' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}
                  >
                    {product.status?.replace(/_/g, ' ') || 'Active'}
                  </button>
                </div>
              </div>
              <button onClick={() => deleteProduct(product.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[60] flex items-end"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-md mx-auto rounded-t-3xl p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Add Product</h3>
                <button onClick={() => setShowAdd(false)} className="text-slate-400">Close</button>
              </div>
              <form onSubmit={handleAddProduct} className="space-y-4">
                <input
                  type="text"
                  placeholder="Product Name"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={newProduct.name}
                  onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                  required
                />
                <textarea
                  placeholder="Description"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[100px]"
                  value={newProduct.description}
                  onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                />
                <input
                  type="number"
                  placeholder="Price (₹)"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={newProduct.price}
                  onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                  required
                />
                <input
                  type="text"
                  placeholder="Image URL (Optional)"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={newProduct.image_url}
                  onChange={e => setNewProduct({...newProduct, image_url: e.target.value})}
                />
                <select
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={newProduct.category}
                  onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                >
                  <option>Grocery</option>
                  <option>Snacks</option>
                  <option>Medicine</option>
                  <option>Dairy</option>
                  <option>Vegetables</option>
                </select>
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Adding...' : 'Save Product'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AdminDashboardView = ({ activeTab, logout, dbStatus }: { activeTab: string, logout: () => void, dbStatus: any }) => {
  const [stats, setStats] = useState({ users: 0, sellers: 0, orders: 0, earnings: 0 });
  const [sellers, setSellers] = useState<any[]>([]);

  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [showAllProducts, setShowAllProducts] = useState(false);

  useEffect(() => {
    fetch('/api/admin/stats').then(res => res.json()).then(setStats);
    fetch('/api/admin/sellers').then(res => res.json()).then(data => setSellers(Array.isArray(data) ? data : []));
    if (showAllProducts) {
      fetch('/api/products/nearby').then(res => res.json()).then(data => setAllProducts(Array.isArray(data) ? data : []));
    }
  }, [activeTab, showAllProducts]);

  const toggleApproval = async (id: string, current: boolean) => {
    await fetch(`/api/admin/sellers/${id}/approve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: !current })
    });
    fetch('/api/admin/sellers').then(res => res.json()).then(data => setSellers(Array.isArray(data) ? data : []));
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      <header className="p-6 bg-white border-b border-slate-100 flex justify-between items-center">
        <h2 className="text-xl font-bold font-display">Admin Panel</h2>
        <button onClick={logout} className="p-2 text-slate-400 hover:text-red-500"><LogOut size={20} /></button>
      </header>

      <div className="p-6 space-y-6 flex-1 overflow-y-auto pb-24">
        {dbStatus && dbStatus.status === 'error' && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl mb-4">
            <div className="flex items-center gap-2 text-red-600 font-bold mb-1">
              <ShieldCheck size={18} />
              <span>Supabase Connection Error</span>
            </div>
            <p className="text-sm text-red-500">{dbStatus.message}</p>
            {dbStatus.config && (
              <div className="mt-2 text-xs text-red-400">
                URL: {dbStatus.config.url} | Key: {dbStatus.config.key}
              </div>
            )}
            <p className="mt-2 text-xs text-slate-500 italic">
              Hint: Make sure you've run the SQL in supabase_schema.sql and set your environment variables.
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Users</p>
            <h3 className="text-xl font-bold">{stats.users}</h3>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Sellers</p>
            <h3 className="text-xl font-bold">{stats.sellers}</h3>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Orders</p>
            <h3 className="text-xl font-bold">{stats.orders}</h3>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Platform Earnings</p>
            <h3 className="text-xl font-bold text-emerald-600">₹{stats.earnings}</h3>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold">Seller Management</h4>
            <button 
              onClick={() => setShowAllProducts(!showAllProducts)}
              className="text-emerald-600 text-xs font-medium"
            >
              {showAllProducts ? 'Show Sellers' : 'Verify All Products'}
            </button>
          </div>

          {showAllProducts ? (
            <div className="space-y-3">
              {allProducts.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-slate-200">
                  <Package className="mx-auto text-slate-300 mb-2" size={32} />
                  <p className="text-slate-500 text-xs">No products found in DB for approved sellers</p>
                </div>
              ) : (
                allProducts.map(p => (
                  <div key={p.id} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
                    <img src={p.image_url || `https://picsum.photos/seed/${p.id}/100/100`} className="w-10 h-10 rounded-lg object-cover" referrerPolicy="no-referrer" />
                    <div className="flex-1">
                      <p className="font-semibold text-xs">{p.name}</p>
                      <p className="text-[10px] text-slate-400">{p.shop_name} • ₹{p.price}</p>
                    </div>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase ${p.status === 'available' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      {p.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {sellers.map(s => (
                <div key={s.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{s.shop_name}</p>
                    <p className="text-xs text-slate-400">{s.name} • {s.mobile}</p>
                  </div>
                  <button 
                    onClick={() => toggleApproval(s.id, s.approved)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${s.approved ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}
                  >
                    {s.approved ? 'Approved' : 'Approve'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const BottomNav = ({ activeTab, setActiveTab, role }: { activeTab: string, setActiveTab: (tab: string) => void, role: string }) => {
  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'categories', icon: LayoutGrid, label: 'Categories' },
    { id: 'orders', icon: ShoppingBag, label: 'Orders' },
    { id: 'wallet', icon: Wallet, label: 'Wallet' },
    { id: 'account', icon: UserIcon, label: 'Account' },
  ];

  if (role === 'seller') {
    tabs[0] = { id: 'seller-dashboard', icon: Home, label: 'Dashboard' };
    tabs[1] = { id: 'seller-products', icon: Plus, label: 'Products' };
  } else if (role === 'admin') {
    tabs[0] = { id: 'admin-dashboard', icon: ShieldCheck, label: 'Admin' };
  }

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
        >
          <tab.icon size={24} />
          <span className="text-[10px]">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [roleMode, setRoleMode] = useState<'customer' | 'seller'>('customer');
  const [notifications, setNotifications] = useState<{ id: number; message: string; type: 'info' | 'success' }[]>([]);
  const [dbStatus, setDbStatus] = useState<{ status: string; message: string; config: any } | null>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editFormData, setEditFormData] = useState({ name: '', email: '' });
  
  const socketRef = useRef<Socket | null>(null);

  // Auth State
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    password: '',
    shopName: ''
  });

  useEffect(() => {
    fetch('/api/health').then(res => res.json()).then(setDbStatus);
    const savedUser = localStorage.getItem('aliflaila_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      if (parsed.role === 'seller') setActiveTab('seller-dashboard');
      if (parsed.role === 'admin') setActiveTab('admin-dashboard');
    }

    // Auto-detect location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(newLoc);
          const savedUser = localStorage.getItem('aliflaila_user');
          if (savedUser) {
            const parsed = JSON.parse(savedUser);
            await fetch(`/api/users/${parsed.id}/location`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newLoc)
            });
          }
        },
        (err) => console.error("Location error:", err)
      );
    }
  }, []);

  useEffect(() => {
    if (user) {
      // Initialize Socket
      socketRef.current = io();
      
      const socket = socketRef.current;

      socket.on('connect', () => {
        console.log('Connected to socket server');
        socket.emit('join', user.id);
        if (user.role === 'seller' && user.sellerInfo) {
          socket.emit('join_seller', user.sellerInfo.id);
        }
      });

      socket.on('new_order', (data) => {
        const message = `New order received! Order #${data.orderId} for ₹${data.totalAmount}`;
        addNotification(message, 'success');
        if (Notification.permission === 'granted') {
          new Notification('Alif Laila: New Order', { body: message, icon: '/favicon.ico' });
        }
      });

      socket.on('order_status_update', (data) => {
        const message = `Your order #${data.orderId} status updated to: ${data.status?.replace(/_/g, ' ') || 'Updated'}`;
        addNotification(message, 'info');
        if (Notification.permission === 'granted') {
          new Notification('Alif Laila: Order Update', { body: message, icon: '/favicon.ico' });
        }
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [user]);

  const addNotification = (message: string, type: 'info' | 'success' = 'info') => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  useEffect(() => {
    if (activeTab === 'home' && (!user?.role || user?.role === 'user' || user?.role === 'customer')) {
      fetchNearbyProducts();
    }
  }, [activeTab, location]);

  const fetchNearbyProducts = async () => {
    setLoading(true);
    try {
      const queryParams = location ? `?lat=${location.lat}&lng=${location.lng}` : '';
      const res = await fetch(`/api/products/nearby${queryParams}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setProducts(data);
      } else {
        setProducts([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: formData.mobile, password: formData.password })
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        if (data.user.lat && data.user.lng) {
          setLocation({ lat: data.user.lat, lng: data.user.lng });
        }
        localStorage.setItem('aliflaila_user', JSON.stringify(data.user));
        
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }

        if (data.user.role === 'seller') setActiveTab('seller-dashboard');
        else if (data.user.role === 'admin') setActiveTab('admin-dashboard');
        else setActiveTab('home');
      } else {
        const errorMessage = data.error || "Login failed";
        const details = data.details ? `\n\nDetails: ${data.details}` : '';
        alert(`${errorMessage}${details}`);
      }
    } catch (err) {
      alert("Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, role: roleMode, lat: location?.lat, lng: location?.lng })
      });
      const data = await res.json();
      if (data.success) {
        alert("Signup successful! Please login.");
        setAuthMode('login');
      } else {
        const errorMessage = data.error || "Signup failed";
        const details = data.details ? `\n\nDetails: ${data.details}` : '';
        const hint = data.hint ? `\n\nHint: ${data.hint}` : '';
        const code = data.code ? `\n\nError Code: ${data.code}` : '';
        alert(`${errorMessage}${details}${hint}${code}`);
      }
    } catch (err) {
      alert("Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('aliflaila_user');
    setActiveTab('home');
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // --- Screens ---

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      });
      const data = await res.json();
      if (data.success) {
        const updatedUser = { ...user, ...data.user };
        setUser(updatedUser);
        localStorage.setItem('aliflaila_user', JSON.stringify(updatedUser));
        setShowEditProfile(false);
        addNotification('Profile updated!', 'success');
      }
    } catch (err) {
      alert("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const updateLocationManually = async () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(newLoc);
        
        if (user) {
          try {
            const res = await fetch(`/api/users/${user.id}/location`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newLoc)
            });
            const data = await res.json();
            if (data.success) {
              const updatedUser = { ...user, lat: newLoc.lat, lng: newLoc.lng };
              setUser(updatedUser);
              localStorage.setItem('aliflaila_user', JSON.stringify(updatedUser));
              addNotification('Location updated successfully!', 'success');
              fetchNearbyProducts();
            }
          } catch (err) {
            console.error(err);
            alert("Failed to update location on server");
          }
        } else {
          addNotification('Location set!', 'success');
          fetchNearbyProducts();
        }
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        alert("Could not get your location. Please enable location permissions.");
      }
    );
  };

  const renderAuth = () => (
    <div className="p-6 flex flex-col h-full justify-center">
      {dbStatus && dbStatus.status === 'error' && (
        <div className="fixed inset-0 z-50 bg-white p-8 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-6">
            <ShieldCheck size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            {dbStatus.supabase === 'invalid_key' ? "Wrong Key Type" : 
             dbStatus.supabase === 'missing_key' ? "API Key Missing" : 
             "Database Setup Required"}
          </h2>
          <p className="text-slate-500 mb-8 max-w-md">
            {dbStatus.supabase === 'invalid_key' 
              ? "Aapne 'Stripe' ki keys copy kar li hain. Ye keys payment ke liye hoti hain, database ke liye nahi."
              : dbStatus.supabase === 'missing_key'
              ? "Aapne Supabase API Key nahi daali hai."
              : "Database connected hai, lekin tables (Users, Sellers) nahi bane hain."}
          </p>
          
          <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl w-full max-w-md mb-8 text-left">
            <p className="text-sm font-bold text-slate-700 mb-2">Sahi Key Kaise Milegi:</p>
            {(dbStatus.supabase === 'invalid_key' || dbStatus.supabase === 'missing_key') ? (
              <div className="space-y-4">
                <div className="bg-red-50 p-3 rounded-xl border border-red-100 mb-4">
                  <p className="text-[10px] text-red-600 font-bold uppercase">❌ Galat Key (Stripe):</p>
                  <p className="text-[10px] text-red-500 italic">sb_publishable_... (Ye nahi chalegi)</p>
                </div>
                
                <ol className="text-xs text-slate-500 space-y-3 list-decimal pl-4">
                  <li>Supabase Dashboard kholiye</li>
                  <li><b>Settings (⚙️)</b> - <b>API</b> par jaaiye</li>
                  <li><b>"Project API keys"</b> section dhoondiye</li>
                  <li><b>"anon" public</b> key copy kijiye</li>
                </ol>

                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <p className="text-[10px] text-emerald-600 font-bold uppercase mb-1">✅ Sahi Key (Supabase):</p>
                  <code className="text-[10px] break-all text-emerald-800 bg-white p-1 rounded block">
                    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
                  </code>
                </div>
              </div>
            ) : (
              <ol className="text-xs text-slate-500 space-y-3 list-decimal pl-4">
                <li><b>SQL Editor</b> par jaaiye</li>
                <li><b>New Query</b> par click kijiye</li>
                <li>Neeche wala code paste karke <b>Run</b> kijiye</li>
              </ol>
            )}
          </div>

          <div className="flex flex-col gap-3 w-full max-w-md">
            {(dbStatus.supabase !== 'invalid_key' && dbStatus.supabase !== 'missing_key') && (
              <button 
                onClick={() => {
                  const sql = `-- Supabase Schema for Aliflaila
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  mobile TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  lat FLOAT,
  lng FLOAT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  shop_name TEXT NOT NULL,
  lat FLOAT,
  lng FLOAT,
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  balance FLOAT DEFAULT 0,
  pending_balance FLOAT DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE sellers DISABLE ROW LEVEL SECURITY;
ALTER TABLE wallets DISABLE ROW LEVEL SECURITY;`;
                navigator.clipboard.writeText(sql);
                alert("SQL Code Copied! Now paste it in Supabase SQL Editor.");
              }}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-200"
            >
              Copy SQL Code
            </button>
          )}
          <button 
            onClick={() => window.location.reload()}
              className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold"
            >
              I've run the code, Refresh App
            </button>
          </div>
        </div>
      )}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-display font-bold text-emerald-600">Alif Laila</h1>
        <p className="text-slate-500 mt-2">Your local marketplace</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-6 text-xs text-amber-800">
        <p className="font-bold mb-1">⚠️ Database Setup Required</p>
        <p className="mb-2">If you see "Insert Error", you need to create tables in Supabase. Copy the code from <code>supabase_schema.sql</code> and run it in your Supabase SQL Editor.</p>
        <button 
          onClick={async () => {
            try {
              const res = await fetch('/api/health');
              const data = await res.json();
              alert(`Status: ${data.status}\nSupabase: ${data.supabase}\nMessage: ${data.message}`);
            } catch (e) {
              alert("Could not connect to server.");
            }
          }}
          className="text-emerald-700 font-bold underline"
        >
          Check Database Connection
        </button>
      </div>

      <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
        <button 
          onClick={() => setAuthMode('login')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${authMode === 'login' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}
        >
          Login
        </button>
        <button 
          onClick={() => setAuthMode('signup')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${authMode === 'signup' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}
        >
          Signup
        </button>
      </div>

      <form onSubmit={authMode === 'login' ? handleLogin : handleSignup} className="space-y-4">
        {authMode === 'signup' && (
          <>
            <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
              <button 
                type="button"
                onClick={() => setRoleMode('customer')}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${roleMode === 'customer' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}
              >
                Customer
              </button>
              <button 
                type="button"
                onClick={() => setRoleMode('seller')}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${roleMode === 'seller' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}
              >
                Seller
              </button>
            </div>
            <input
              type="text"
              placeholder="Full Name"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              required
            />
            {roleMode === 'seller' && (
              <input
                type="text"
                placeholder="Shop Name"
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={formData.shopName}
                onChange={e => setFormData({...formData, shopName: e.target.value})}
                required
              />
            )}
          </>
        )}
        <input
          type="tel"
          placeholder="Mobile Number"
          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
          value={formData.mobile}
          onChange={e => setFormData({...formData, mobile: e.target.value})}
          required
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
          value={formData.password}
          onChange={e => setFormData({...formData, password: e.target.value})}
          required
        />
        <button type="submit" disabled={loading} className="btn-primary w-full mt-4">
          {loading ? 'Processing...' : (authMode === 'login' ? 'Login' : 'Create Account')}
        </button>
      </form>
    </div>
  );

  const renderHome = () => (
    <div className="flex-1 overflow-y-auto pb-24">
      {dbStatus && dbStatus.status === 'error' && (
        <div className="bg-red-500 text-white p-3 text-center text-xs font-bold flex items-center justify-center gap-2">
          <ShieldCheck size={14} />
          <span>Database not configured. Please check Admin Panel.</span>
        </div>
      )}
      <header className="p-6 bg-white sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="text-emerald-600" size={20} />
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Delivery to</p>
              <p className="text-sm font-semibold truncate max-w-[150px]">
                {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Location not set'}
              </p>
            </div>
            <button 
              onClick={updateLocationManually}
              className="p-1 text-slate-400 hover:text-emerald-600 transition-colors"
            >
              <RefreshCw size={14} />
            </button>
          </div>
          <button onClick={() => setActiveTab('cart')} className="relative p-2 bg-slate-100 rounded-full">
            <ShoppingBag size={20} />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {cart.length}
              </span>
            )}
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search for products..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          />
        </div>
      </header>

      <div className="px-6 space-y-6">
        {!location && (
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                <MapPin size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-800">Set your location</p>
                <p className="text-[10px] text-emerald-600">To see products near you</p>
              </div>
            </div>
            <button 
              onClick={updateLocationManually}
              className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-bold rounded-xl shadow-lg shadow-emerald-200"
            >
              Set Now
            </button>
          </div>
        )}
        {/* Banner */}
        <div className="bg-emerald-600 rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-xl font-bold mb-1">Fresh Groceries</h3>
            <p className="text-emerald-100 text-sm mb-4">Delivered in 5 KM radius</p>
            <button className="bg-white text-emerald-600 px-4 py-2 rounded-lg text-xs font-bold">Shop Now</button>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-full -mr-16 -mt-16 opacity-50"></div>
        </div>

        {/* Categories Quick Links */}
        <div className="grid grid-cols-4 gap-4">
          {['Grocery', 'Snacks', 'Dairy', 'Veg'].map((cat) => (
            <button key={cat} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
                <LayoutGrid size={24} className="text-emerald-600" />
              </div>
              <span className="text-[10px] font-medium text-slate-600">{cat}</span>
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold font-display">Nearby Products</h2>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => fetchNearbyProducts()}
                className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors"
                title="Refresh"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
              <button 
                onClick={() => {
                  setLocation(null);
                  fetchNearbyProducts();
                }}
                className="text-emerald-600 text-sm font-medium"
              >
                See all
              </button>
            </div>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Package className="mx-auto text-slate-300 mb-2" size={40} />
              <p className="text-slate-500 text-sm mb-2">No products found nearby</p>
              <p className="text-[10px] text-slate-400 max-w-[200px] mx-auto italic">
                Hint: Sellers must be "Approved" by Admin and have "Available" products to show up here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {products.map((product) => (
                <motion.div 
                  key={product.id} 
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="product-card"
                >
                  <div className="aspect-square bg-slate-100 relative">
                    <img 
                      src={product.image_url || `https://picsum.photos/seed/${product.id}/400/400`} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-[8px] font-bold uppercase text-emerald-600">
                      {product.shop_name}
                    </div>
                  </div>
                  <div className="p-3">
                    <h4 className="text-sm font-semibold truncate mb-1">{product.name}</h4>
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-600 font-bold">₹{product.price}</span>
                      <button 
                        onClick={() => addToCart(product)}
                        className="bg-emerald-600 text-white p-1.5 rounded-lg hover:bg-emerald-700 active:scale-90 transition-all"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderCart = () => (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      <header className="p-6 bg-white border-b border-slate-100 flex items-center gap-4">
        <button onClick={() => setActiveTab('home')} className="p-2 hover:bg-slate-100 rounded-full">
          <ChevronRight className="rotate-180" size={24} />
        </button>
        <h2 className="text-xl font-bold font-display">Your Cart</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <ShoppingBag size={40} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-bold mb-1">Your cart is empty</h3>
            <p className="text-slate-500 text-sm mb-6">Add some products to get started</p>
            <button onClick={() => setActiveTab('home')} className="btn-primary">Start Shopping</button>
          </div>
        ) : (
          <>
            {cart.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-2xl flex gap-4 shadow-sm">
                <img 
                  src={item.image_url || `https://picsum.photos/seed/${item.id}/200/200`} 
                  className="w-20 h-20 rounded-xl object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-semibold text-sm">{item.name}</h4>
                    <p className="text-slate-400 text-xs">{item.shop_name}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-600">₹{item.price * item.quantity}</span>
                    <div className="flex items-center gap-3 bg-slate-100 px-2 py-1 rounded-lg">
                      <button onClick={() => updateQuantity(item.id, -1)} className="text-slate-500"><Minus size={14} /></button>
                      <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="text-slate-500"><Plus size={14} /></button>
                    </div>
                  </div>
                </div>
                <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-red-500">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      {cart.length > 0 && (
        <div className="bg-white p-6 border-t border-slate-100 space-y-4 pb-24">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium">₹{totalAmount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Delivery Fee</span>
              <span className="text-emerald-600 font-medium">FREE</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-50">
              <span>Total</span>
              <span>₹{totalAmount}</span>
            </div>
          </div>
          <button 
            onClick={async () => {
              if (!user) {
                setAuthMode('login');
                setActiveTab('account');
                return;
              }
              setLoading(true);
              try {
                const res = await fetch('/api/orders', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    customer_id: user.id,
                    items: cart.map(i => ({ product_id: i.id, quantity: i.quantity, price: i.price, seller_id: i.seller_id })),
                    lat: location?.lat,
                    lng: location?.lng
                  })
                });
                const data = await res.json();
                if (data.success) {
                  setCart([]);
                  setActiveTab('orders');
                  alert("Order placed successfully!");
                }
              } catch (err) {
                alert("Checkout failed");
              } finally {
                setLoading(false);
              }
            }}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? 'Processing...' : (
              <>
                Proceed to Pay <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    if (!user && activeTab !== 'home' && activeTab !== 'categories' && activeTab !== 'cart') {
      return renderAuth();
    }

    switch (activeTab) {
      case 'home': return renderHome();
      case 'cart': return renderCart();
      case 'orders': return <OrdersView user={user} activeTab={activeTab} />;
      case 'wallet': return <WalletView user={user} activeTab={activeTab} />;
      case 'account': return (
        <div className="p-6 flex flex-col h-full bg-slate-50">
          <header className="mb-8">
            <h2 className="text-2xl font-bold font-display">Account</h2>
          </header>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-6 flex items-center gap-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
              <UserIcon size={32} />
            </div>
            <div>
              <h3 className="text-lg font-bold">{user?.name}</h3>
              <p className="text-sm text-slate-400">{user?.mobile}</p>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md mt-1 inline-block">
                {user?.role}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <button 
              onClick={updateLocationManually}
              className="w-full flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-slate-50"
            >
              <div className="flex items-center gap-3">
                <MapPin size={20} className="text-slate-400" />
                <span className="text-sm font-medium">Update Location</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  {location ? 'Set' : 'Not Set'}
                </span>
                <ChevronRight size={18} className="text-slate-300" />
              </div>
            </button>
            <button 
              onClick={() => {
                if ('Notification' in window) {
                  Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                      addNotification('Notifications enabled!', 'success');
                    }
                  });
                }
              }}
              className="w-full flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-slate-50"
            >
              <div className="flex items-center gap-3">
                <Bell size={20} className="text-slate-400" />
                <span className="text-sm font-medium">Enable Notifications</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  {typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'Not Supported'}
                </span>
                <ChevronRight size={18} className="text-slate-300" />
              </div>
            </button>
            <button 
              onClick={() => {
                setEditFormData({ name: user?.name || '', email: user?.email || '' });
                setShowEditProfile(true);
              }}
              className="w-full flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-slate-50"
            >
              <div className="flex items-center gap-3">
                <Settings size={20} className="text-slate-400" />
                <span className="text-sm font-medium">Edit Profile</span>
              </div>
              <ChevronRight size={18} className="text-slate-300" />
            </button>
            <button onClick={logout} className="w-full flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-slate-50 text-red-500">
              <div className="flex items-center gap-3">
                <LogOut size={20} />
                <span className="text-sm font-medium">Logout</span>
              </div>
              <ChevronRight size={18} className="text-slate-300" />
            </button>
          </div>
        </div>
      );
      case 'seller-dashboard': return <SellerDashboardView user={user} activeTab={activeTab} setActiveTab={setActiveTab} logout={logout} />;
      case 'seller-products': return <SellerProductsView user={user} activeTab={activeTab} />;
      case 'admin-dashboard': return <AdminDashboardView activeTab={activeTab} logout={logout} dbStatus={dbStatus} />;
      default: return renderHome();
    }
  };

  return (
    <div className="mobile-container overflow-hidden">
      {/* Notifications Overlay */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[320px] space-y-2">
        <AnimatePresence>
          {notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`p-4 rounded-2xl shadow-lg border flex items-center gap-3 ${
                n.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-white text-slate-800 border-slate-100'
              }`}
            >
              <Bell size={18} className={n.type === 'success' ? 'text-emerald-100' : 'text-emerald-600'} />
              <p className="text-xs font-medium leading-tight">{n.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {renderContent()}
      
      <AnimatePresence>
        {showEditProfile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-8 overflow-hidden"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold font-display">Edit Profile</h3>
                <button onClick={() => setShowEditProfile(false)} className="p-2 bg-slate-100 rounded-full text-slate-400">
                  <XCircle size={20} />
                </button>
              </div>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 ml-1 mb-1 block">Full Name</label>
                  <input
                    type="text"
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={editFormData.name}
                    onChange={e => setEditFormData({...editFormData, name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 ml-1 mb-1 block">Email Address</label>
                  <input
                    type="email"
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={editFormData.email}
                    onChange={e => setEditFormData({...editFormData, email: e.target.value})}
                  />
                </div>
                
                <div className="pt-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowEditProfile(false);
                      updateLocationManually();
                    }}
                    className="w-full flex items-center justify-center gap-2 p-4 bg-emerald-50 text-emerald-600 rounded-2xl font-bold text-sm border border-emerald-100"
                  >
                    <MapPin size={18} />
                    Update My Location
                  </button>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full mt-4 py-4">
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} role={user?.role || 'customer'} />
    </div>
  );
}
