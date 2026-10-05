import { Link } from 'react-router-dom';
import usePageTitle from '../hooks/usePageTitle';

export default function NotFound() {
  usePageTitle('Page not found');
  return (
    <div className="min-h-[70vh] bg-[#0b0a08] text-[#f3eee3] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="font-mono text-[10px] tracking-[0.35em] uppercase text-[#e3a857] mb-6">Error 404</p>
        <h1 className="font-display text-5xl md:text-6xl font-semibold leading-tight">Page not found.</h1>
        <p className="mt-5 text-sm text-[#f3eee3]/50 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has moved. Try searching, or head back to the shop.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link
            to="/"
            className="px-6 py-3 rounded-sm text-sm font-medium text-[#0b0a08] bg-gradient-to-r from-[#f0c07f] to-[#e3a857]"
          >
            Go to home
          </Link>
          <Link
            to="/products"
            className="px-6 py-3 rounded-sm text-sm border border-[#f3eee3]/20 hover:border-[#e3a857] hover:text-[#e3a857] transition-colors"
          >
            Browse products
          </Link>
        </div>
      </div>
    </div>
  );
}
