import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import ProductRow from '../components/ProductRow';
import OfferCarousel from '../components/OfferCarousel';
import { recentlyViewed } from '../utils/recent';
import { sortCategories, shortName, CATEGORY_LABEL } from '../utils/categories';
import usePageTitle from '../hooks/usePageTitle';

// Lifestyle photo (Pexels) and tagline for each category. A category added later
// without an entry here still appears, using a product photo from the API.
const CATEGORY_STYLE = {
  electronics: {
    tags: 'Audio · Devices · Gadgets',
    img: 'https://images.pexels.com/photos/14741306/pexels-photo-14741306.jpeg?auto=compress&cs=tinysrgb&w=1200',
  },
  clothing: {
    tags: 'Denim · Basics · Outerwear',
    img: 'https://images.pexels.com/photos/8581058/pexels-photo-8581058.jpeg?auto=compress&cs=tinysrgb&w=1200',
  },
  accessories: {
    tags: 'Watches · Bags · Jewellery',
    img: 'https://images.pexels.com/photos/380782/pexels-photo-380782.jpeg?auto=compress&cs=tinysrgb&w=1200',
  },
  'home-kitchen': {
    tags: 'Ceramics · Lighting · Textiles',
    img: 'https://images.pexels.com/photos/27180805/pexels-photo-27180805.jpeg?auto=compress&cs=tinysrgb&w=1200',
  },
  beauty: {
    tags: 'Makeup · Fragrance · Body care',
    img: 'https://images.pexels.com/photos/2566853/pexels-photo-2566853.jpeg?auto=compress&cs=tinysrgb&w=1200',
  },
  groceries: {
    tags: 'Fresh · Pantry · Beverages',
    img: 'https://images.pexels.com/photos/9705821/pexels-photo-9705821.jpeg?auto=compress&cs=tinysrgb&w=1200',
  },
  sports: {
    tags: 'Footwear · Fitness · Outdoor',
    img: 'https://images.pexels.com/photos/16918373/pexels-photo-16918373.jpeg?auto=compress&cs=tinysrgb&w=1200',
  },
  books: {
    tags: 'Fiction · Non-fiction · Journals',
    img: 'https://images.pexels.com/photos/12596070/pexels-photo-12596070.jpeg?auto=compress&cs=tinysrgb&w=1200',
  },
};

// Biggest discounts first, but at most `perCategory` from any one category,
// so the deals row isn't all books.
function mixCategories(products, perCategory, total) {
  const seen = {};
  return products
    .filter((p) => {
      const key = p.category_slug || p.subcategory || 'other';
      seen[key] = (seen[key] || 0) + 1;
      return seen[key] <= perCategory;
    })
    .slice(0, total);
}

export default function Home() {
  usePageTitle();
  const [categories, setCategories] = useState([]);
  const [deals, setDeals] = useState([]);
  const [bestsellers, setBestsellers] = useState([]);
  const [recent] = useState(() => recentlyViewed());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/categories'),
      api.get('/products?sort=discount&limit=60'),
      api.get('/products?sort=popular&limit=12'),
    ])
      .then(([catRes, dealsRes, bestRes]) => {
        setCategories(catRes.data.categories);
        setDeals(mixCategories(dealsRes.data.products, 2, 12));
        setBestsellers(bestRes.data.products);
      })
      .finally(() => setLoading(false));
  }, []);

  const homeCategories = sortCategories(categories)
    .map((c, i) => ({
      slug: c.slug,
      name: shortName(c), // short name: the home page sets it in very large type
      num: String(i + 1).padStart(2, '0'),
      tags: CATEGORY_STYLE[c.slug]?.tags || c.description || '',
      img: CATEGORY_STYLE[c.slug]?.img || c.image_url,
      align: i % 2 === 0 ? 'left' : 'right',
    }));
  const totalLabel = String(homeCategories.length).padStart(2, '0');

  return (
    <div className="bg-[#0b0a08] text-[#f3eee3] min-h-screen">
      {/* Local keyframes — move into your global CSS whenever convenient */}
      <style>{`
        @keyframes ss-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes ss-glow {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        .ss-marquee-track {
          animation: ss-marquee 32s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .ss-marquee-track { animation: none; }
        }
      `}</style>

      {/* =========================
          HERO SECTION
      ========================== */}
      <section
        className="relative min-h-[620px] flex items-center justify-center overflow-hidden px-6"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
          e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
        }}
      >
        {/* Ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(600px circle at 20% 20%, rgba(227,168,87,0.10), transparent 60%), radial-gradient(500px circle at 85% 75%, rgba(95,184,166,0.08), transparent 60%)',
          }}
        />

        {/* Subtle background words */}
        <div className="absolute inset-0 pointer-events-none select-none">
          <span className="absolute top-[18%] left-[12%] font-mono text-[10px] tracking-[0.25em] text-[#f3eee3]/15 uppercase">
            Discover
          </span>
          <span className="absolute top-[30%] right-[14%] font-mono text-[10px] tracking-[0.25em] text-[#f3eee3]/15 uppercase">
            Compare
          </span>
          <span className="absolute bottom-[24%] left-[18%] font-mono text-[10px] tracking-[0.25em] text-[#f3eee3]/15 uppercase">
            Choose
          </span>
          <span className="absolute bottom-[20%] right-[17%] font-mono text-[10px] tracking-[0.25em] text-[#f3eee3]/15 uppercase">
            Shop
          </span>
        </div>

        {/* Main hero content */}
        <div className="relative z-10 text-center select-none">
          <p className="font-mono text-[10px] tracking-[0.35em] text-[#e3a857]/70 uppercase mb-6">
            {homeCategories.length || 'Every'} categories · one catalog
          </p>

          {/* Interactive ShopSmart text */}
          <div className="relative">
            {/* Dim base text */}
            <h1 className="font-display text-[clamp(4rem,11vw,9rem)] font-semibold leading-none tracking-tight text-[#f3eee3]/[0.06]">
              ShopSmart
            </h1>

            {/* Glowing text revealed by cursor */}
            <h1
              className="absolute inset-0 font-display text-[clamp(4rem,11vw,9rem)] font-semibold leading-none tracking-tight pointer-events-none"
              style={{
                backgroundImage: 'linear-gradient(135deg, #f3eee3 0%, #e3a857 60%, #c98a34 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                filter: 'drop-shadow(0 0 24px rgba(227,168,87,0.35))',
                WebkitMaskImage:
                  'radial-gradient(circle 130px at var(--mouse-x) var(--mouse-y), black 0%, transparent 100%)',
                maskImage:
                  'radial-gradient(circle 130px at var(--mouse-x) var(--mouse-y), black 0%, transparent 100%)',
              }}
            >
              ShopSmart
            </h1>
          </div>

          {/* Hero description */}
          <div className="mt-10 max-w-xl mx-auto">
            <p className="text-[#f3eee3]/45 text-sm md:text-base leading-relaxed">
              Everything you need,
              <br />
              nothing you don't.
            </p>

            <Link
              to="/products"
              className="inline-block mt-7 px-7 py-3 rounded-sm font-medium text-sm text-[#0b0a08] bg-gradient-to-r from-[#f0c07f] to-[#e3a857] hover:from-[#e3a857] hover:to-[#c98a34] transition-all shadow-[0_0_30px_rgba(227,168,87,0.25)]"
            >
              Explore products
            </Link>
          </div>
        </div>
      </section>

      {/* =========================
          CATEGORY TICKER (signature strip)
      ========================== */}
      <div className="border-y border-[#f3eee3]/10 overflow-hidden bg-[#0f0d0a]">
        <div className="flex whitespace-nowrap ss-marquee-track py-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex shrink-0">
              {Object.values(CATEGORY_LABEL).map((label) => (
                <span
                  key={`${i}-${label}`}
                  className="mx-6 font-mono text-[11px] tracking-[0.2em] uppercase text-[#f3eee3]/35"
                >
                  {label} <span className="text-[#e3a857]/50">·</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* =========================
          OFFERS + TODAY'S DEALS
      ========================== */}
      <OfferCarousel />

      <ProductRow
        eyebrow="Limited time"
        title="Today's deals"
        viewAllTo="/products?sort=discount"
        products={deals}
        loading={loading}
      />

      {/* =========================
    CINEMATIC CATEGORY SHOWCASE
========================== */}
{/* =========================
    CINEMATIC CATEGORY SHOWCASE
========================== */}
<section className="relative bg-[#0b0a08] text-[#f3eee3] overflow-hidden">
  {/* Section intro */}
  <div className="max-w-6xl mx-auto px-6 pt-28 pb-16">
    <p className="font-mono text-[10px] tracking-[0.3em] text-[#e3a857] uppercase mb-3">
      The collection
    </p>
    <h2 className="font-display text-4xl md:text-6xl font-semibold">
      Explore by category.
    </h2>
  </div>

  {homeCategories.map((cat) => {
    const isLeft = cat.align === 'left';
    return (
      <Link
        key={cat.slug}
        to={`/category/${cat.slug}`}
        className="group relative block min-h-[90vh] overflow-hidden"
      >
        {/* Giant background number */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="font-display text-[35vw] leading-none text-[#f3eee3]/[0.025]">
            {cat.num}
          </span>
        </div>

        {/* Main product image */}
        <div className="relative z-10 flex justify-center items-center min-h-[75vh]">
          <img
            src={cat.img}
            alt={cat.name}
            className="w-[55vw] max-w-[620px] h-[60vh] object-cover rounded-sm
                       opacity-75 grayscale
                       group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-[1.04]
                       transition-all duration-[1200ms] ease-out"
          />
        </div>

        {/* Category title */}
        <div
          className={`absolute z-20 top-[18%] ${
            isLeft ? 'left-[7%] md:left-[10%] text-left' : 'right-[7%] md:right-[10%] text-right'
          }`}
        >
          <p className="font-mono text-[10px] tracking-[0.3em] text-[#f3eee3]/35 mb-4">
            {cat.num} / {totalLabel}
          </p>
          <h3
            className="font-display text-6xl md:text-[8rem] font-semibold leading-none
                       text-[#f3eee3]/90 group-hover:text-[#e3a857] transition-colors duration-500"
          >
            {cat.name}
          </h3>
        </div>

        {/* Description */}
        <div
          className={`absolute z-20 bottom-[13%] ${
            isLeft ? 'right-[7%] md:right-[10%] text-right' : 'left-[7%] md:left-[10%] text-left'
          }`}
        >
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#f3eee3]/35 mb-3">
            {cat.tags}
          </p>
          <span
            className={`inline-flex items-center gap-3 text-sm text-[#f3eee3]/70
                       group-hover:text-[#e3a857] transition-colors ${
                         isLeft ? '' : 'flex-row-reverse'
                       }`}
          >
            Explore {cat.name.toLowerCase()}
            <span className="text-lg">↗</span>
          </span>
        </div>

        {/* Decorative lines */}
        <div className="absolute left-[7%] right-[7%] bottom-8 h-px bg-[#f3eee3]/10" />
      </Link>
    );
  })}
</section>
      {/* =========================
          BESTSELLERS
      ========================== */}
      <ProductRow
        eyebrow="Most loved"
        title="Bestsellers"
        viewAllTo="/products?sort=popular"
        products={bestsellers}
        loading={loading}
      />

      {recent.length > 0 && (
        <ProductRow eyebrow="Pick up where you left off" title="Recently viewed" products={recent} loading={false} />
      )}

      {/* =========================
          CTA SECTION
      ========================== */}
      <section className="relative border-t border-[#f3eee3]/10 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(500px circle at 50% 40%, rgba(227,168,87,0.14), transparent 65%)',
          }}
        />
        <div className="relative max-w-6xl mx-auto px-6 py-24 text-center">
          <p className="font-mono text-[10px] tracking-[0.3em] text-[#e3a857] uppercase mb-4">
            Shop smarter
          </p>

          <h2 className="font-display text-4xl md:text-5xl font-semibold leading-tight mb-5 text-[#f3eee3]">
            Find something
            <br />
            you'll love.
          </h2>

          <p className="text-[#f3eee3]/45 max-w-md mx-auto text-sm leading-relaxed mb-8">
            Electronics, fashion, home, beauty, groceries, sports, books and more, all in one place.
          </p>

          <Link
            to="/products"
            className="inline-block px-7 py-3 rounded-sm font-medium text-sm text-[#0b0a08] bg-gradient-to-r from-[#f0c07f] to-[#e3a857] hover:from-[#e3a857] hover:to-[#c98a34] transition-all shadow-[0_0_30px_rgba(227,168,87,0.25)]"
          >
            Browse everything
          </Link>
        </div>
      </section>
    </div>
  );
}