import { lazy, Suspense } from 'react';
import ShopSmartBackground from './components/ShopSmartBackground';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

import DarkPage from './components/DarkPage';
import NotFound from './pages/NotFound';

// Admin pages (and their chart library) load only when /admin is opened.
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));

// The customer-facing store: animated background, header, footer.
function Storefront() {
  return (
    <>
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
            {/* The public bot feed moved into Admin → Bot activity */}
            <Route path="/activity" element={<Navigate to="/admin?tab=activity" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            {/* Admin is a separate app: own layout and light theme, no store header/footer */}
            <Route
              path="/admin"
              element={
                <Suspense fallback={<div className="min-h-screen bg-[#f5f6f8]" />}>
                  <AdminLayout />
                </Suspense>
              }
            />
            <Route path="*" element={<Storefront />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
