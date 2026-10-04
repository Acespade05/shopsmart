import { useRef } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from './ProductCard';

// Horizontally scrolling row of product cards (e.g. "Today's deals"),
// styled for the dark storefront.
export default function ProductRow({ eyebrow, title, viewAllTo, products, loading }) {
  const scroller = useRef(null);

  function scrollBy(direction) {
    const el = scroller.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  }

  return (
    <section className="max-w-7xl mx-auto px-6 py-16">
      <div className="flex items-end justify-between mb-8 gap-6">
        <div>
          <p className="font-mono text-[10px] tracking-[0.25em] text-[#e3a857] uppercase mb-2">{eyebrow}</p>
          <h2 className="text-2xl md:text-3xl font-display font-semibold text-[#f3eee3]">{title}</h2>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => scrollBy(-1)}
            aria-label="Scroll left"
            className="hidden md:flex w-9 h-9 items-center justify-center border border-[#f3eee3]/15 text-[#f3eee3]/60 hover:border-[#e3a857] hover:text-[#e3a857] transition-colors rounded-sm"
          >
            ←
          </button>
          <button
            onClick={() => scrollBy(1)}
            aria-label="Scroll right"
            className="hidden md:flex w-9 h-9 items-center justify-center border border-[#f3eee3]/15 text-[#f3eee3]/60 hover:border-[#e3a857] hover:text-[#e3a857] transition-colors rounded-sm"
          >
            →
          </button>
          {viewAllTo && (
            <Link to={viewAllTo} className="ml-2 text-sm text-[#e3a857] hover:text-[#f0c07f] transition-colors">
              View all →
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-[#f3eee3]/40 text-sm font-mono">Loading products…</p>
      ) : (
        <div
          ref={scroller}
          className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 [scrollbar-width:thin]
            [&_.bg-emerald-light]:!bg-[#14120f]
            [&_.text-ink]:!text-[#f3eee3]
            [&_.text-ink\/60]:!text-[#f3eee3]/50
            [&_.text-ink\/40]:!text-[#f3eee3]/35
            [&_.text-ink\/20]:!text-[#f3eee3]/20
            [&_.border-ink\/20]:!border-[#f3eee3]/20"
        >
          {products.map((product) => (
            <div key={product.id} className="snap-start shrink-0 w-[46%] sm:w-[30%] md:w-[22%] lg:w-[18%]">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
