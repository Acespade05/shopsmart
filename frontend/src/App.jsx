import { lazy, Suspense } from 'react';
import ShopSmartBackground from './components/ShopSmartBackground';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import ProductList from './pages/ProductList';
import ProductDetail from './pages/ProductDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Cart from './pages/Cart';
import Category from './pages/Category';
import Wishlist from './pages/Wishlist';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Search from './pages/Search';
import Profile from './pages/Profile';
import LiveActivity from './pages/LiveActivity';

import DarkPage from './components/DarkPage';

// Admin pages (and their chart library) load only when /admin is opened.
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>

          {/* Animated ShopSmart background */}
          <ShopSmartBackground />

          <div className="min-h-screen flex flex-col relative z-10">

            <Navbar />

            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/products" element={<ProductList />} />
                <Route path="/products/:slug" element={<ProductDetail />} />
                <Route path="/login" element={<DarkPage><Login /></DarkPage>} />
                <Route path="/register" element={<DarkPage><Register /></DarkPage>} />
                <Route path="/cart" element={<DarkPage><Cart /></DarkPage>} />
                <Route path="/category/:slug" element={<Category />} />
                <Route path="/wishlist" element={<DarkPage><Wishlist /></DarkPage>} />
                <Route path="/checkout" element={<DarkPage><Checkout /></DarkPage>} />
                <Route path="/orders" element={<DarkPage><Orders /></DarkPage>} />
                <Route path="/orders/:id" element={<DarkPage><OrderDetail /></DarkPage>} />
                <Route path="/search" element={<DarkPage><Search /></DarkPage>} />
                <Route path="/profile" element={<DarkPage><Profile /></DarkPage>} />
                <Route path="/activity" element={<DarkPage><LiveActivity /></DarkPage>} />
                <Route
                  path="/admin"
                  element={
                    <DarkPage>
                      <Suspense fallback={<p className="max-w-6xl mx-auto px-6 py-10 text-sm text-[#f3eee3]/40">Loading…</p>}>
                        <AdminLayout />
                      </Suspense>
                    </DarkPage>
                  }
                />
              </Routes>
            </main>

            <Footer />

          </div>

        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;