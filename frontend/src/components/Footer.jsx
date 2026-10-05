import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { sortCategories } from '../utils/categories';

function Column({ title, children }) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#e3a857] mb-4">{title}</p>
      <ul className="space-y-2.5 text-sm text-[#f3eee3]/50">{children}</ul>
    </div>
  );
}

function Item({ to, children }) {
  return (
    <li>
      <Link to={to} className="hover:text-[#f3eee3] transition-colors">
        {children}
      </Link>
    </li>
  );
}

export default function Footer() {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api
      .get('/categories')
      .then((res) => setCategories(sortCategories(res.data.categories)))
      .catch(() => {});
  }, []);

  return (
    <footer className="relative z-10 bg-[#0b0a08] border-t border-[#f3eee3]/10">
      <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-5 gap-10">
        <div className="col-span-2">
          <Link to="/" className="font-display text-3xl font-semibold tracking-[-0.04em] text-[#f3eee3]">
            Shop<span className="text-[#e3a857]">Smart</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#f3eee3]/45">
            Everything you need, nothing you don&apos;t. Free delivery on every order, and automatic savings of up
            to 15% at checkout.
          </p>
        </div>

        <Column title="Shop">
          {categories.slice(0, 6).map((c) => (
            <Item key={c.slug} to={`/category/${c.slug}`}>
              {c.name}
            </Item>
          ))}
          <Item to="/products">All products</Item>
        </Column>

        <Column title="Your account">
          <Item to="/orders">Your orders</Item>
          <Item to="/wishlist">Wishlist</Item>
          <Item to="/cart">Cart</Item>
          <Item to="/profile">Profile &amp; addresses</Item>
        </Column>

        <Column title="Explore">
          <Item to="/products?sort=discount">Today&apos;s deals</Item>
          <Item to="/products?sort=popular">Bestsellers</Item>
          <Item to="/products?sort=newest">New arrivals</Item>
        </Column>
      </div>

      <div className="border-t border-[#f3eee3]/[0.06]">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col md:flex-row gap-2 md:items-center md:justify-between text-[11px] text-[#f3eee3]/30">
          <span>© {new Date().getFullYear()} ShopSmart</span>
          <span>Built for the AI-SRE project.</span>
        </div>
      </div>
    </footer>
  );
}
