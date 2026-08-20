import { useParams, Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { products } from '../data/products';

export default function Category() {
  const { slug } = useParams();

  const categoryProducts = products.filter((product) => product.category === slug);

  const categoryInfo = {
    electronics: {
      name: 'Electronics',
      number: '01',
      description: 'Smart devices, accessories, and everyday technology for your setup.',
      tags: 'Audio · Devices · Gadgets',
    },
    apparel: {
      name: 'Apparel',
      number: '02',
      description: 'Everyday essentials, casual wear, and styles made for everyone.',
      tags: 'Style · Everyday · Essentials',
    },
    'home-kitchen': {
      name: 'Home & Kitchen',
      number: '03',
      description: 'Objects that make your home comfortable, functional, and beautiful.',
      tags: 'Home · Kitchen · Living',
    },
    books: {
      name: 'Books',
      number: '04',
      description: 'Stories, ideas, knowledge, and books worth keeping.',
      tags: 'Stories · Ideas · Knowledge',
    },
    sports: {
      name: 'Sports',
      number: '05',
      description: 'Gear and equipment to keep you active, moving, and playing.',
      tags: 'Fitness · Training · Play',
    },
  };

  const category = categoryInfo[slug] || {
    name: 'Category',
    number: '00',
    description: 'Explore our collection.',
    tags: 'Shop · Explore · Discover',
  };

  return (
    <div className="min-h-screen bg-[#0b0a08] text-[#f3eee3]">
      {/* =====================================================
          HERO
      ====================================================== */}
      <section className="relative min-h-[72vh] overflow-hidden flex items-center">
        {/* Ambient glow — consistent with home page */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(650px circle at 15% 25%, rgba(227,168,87,0.09), transparent 60%), radial-gradient(550px circle at 90% 80%, rgba(95,184,166,0.06), transparent 60%)',
          }}
        />

        {/* Giant background number */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="font-display text-[40vw] leading-none text-[#f3eee3]/[0.025]">
            {category.number}
          </span>
        </div>

        {/* Top line */}
        <div className="absolute top-0 left-6 right-6 h-px bg-[#f3eee3]/10" />

        {/* Main content */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-6">
          {/* Collection label */}
          <div className="flex items-center gap-4 mb-8">
            <span className="font-mono text-[10px] tracking-[0.35em] text-[#e3a857] uppercase">
              Collection
            </span>
            <span className="h-px w-16 bg-[#e3a857]/40" />
            <span className="font-mono text-[10px] tracking-[0.2em] text-[#f3eee3]/30">
              {String(categoryProducts.length).padStart(2, '0')} PRODUCTS
            </span>
          </div>

          {/* Huge title */}
          <h1 className="font-display text-[15vw] md:text-[10rem] font-semibold leading-[0.8] tracking-[-0.05em]">
            {category.name}
          </h1>

          {/* Bottom information */}
          <div className="mt-14 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div>
              <p className="max-w-md text-sm leading-7 text-[#f3eee3]/45">
                {category.description}
              </p>
              <p className="mt-4 font-mono text-[9px] tracking-[0.25em] uppercase text-[#e3a857]/60">
                {category.tags}
              </p>
            </div>

            <Link
              to="/products"
              className="group inline-flex items-center gap-3 font-mono text-[10px] tracking-[0.2em] uppercase text-[#f3eee3]/50 hover:text-[#e3a857] transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e3a857]/60 focus-visible:ring-offset-4 focus-visible:ring-offset-[#0b0a08]"
            >
              View all products
              <span className="text-lg group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================
          PRODUCT COLLECTION
      ====================================================== */}
      <section className="relative max-w-7xl mx-auto px-6 pb-32">
        <div className="h-px bg-[#f3eee3]/10 mb-10" />

        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#e3a857] mb-2">
              The collection
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-semibold">{category.name}</h2>
          </div>

          <span className="font-mono text-[10px] tracking-[0.2em] text-[#f3eee3]/30">
            {String(categoryProducts.length).padStart(2, '0')} ITEMS
          </span>
        </div>

        {categoryProducts.length === 0 ? (
          <div className="py-32 flex flex-col items-center text-center">
            <div className="w-12 h-12 mb-6 border border-dashed border-[#e3a857]/25 rounded-sm" />
            <p className="font-display text-3xl text-[#f3eee3]/30">Nothing here yet.</p>
            <p className="mt-3 text-xs text-[#f3eee3]/20">
              This collection is waiting for something new.
            </p>
          </div>
        ) : (
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-16
              [&_.bg-emerald-light]:!bg-[#14120f]
              [&_.text-ink]:!text-[#f3eee3]
              [&_.text-ink\/60]:!text-[#f3eee3]/50
              [&_.text-ink\/40]:!text-[#f3eee3]/30
              [&_.text-ink\/20]:!text-[#f3eee3]/20
              [&_.border-line]:!border-[#f3eee3]/10"
          >
            {categoryProducts.map((product) => (
              <div
                key={product.id}
                className="group rounded-sm transition-all duration-300 hover:-translate-y-1 focus-within:-translate-y-1"
              >
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* =====================================================
          BOTTOM CTA
      ====================================================== */}
      <section className="relative border-t border-[#f3eee3]/10 py-24 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(500px circle at 50% 40%, rgba(227,168,87,0.10), transparent 65%)',
          }}
        />

        <div className="relative max-w-7xl mx-auto px-6 text-center">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#e3a857] mb-5">
            Keep exploring
          </p>

          <h2 className="font-display text-4xl md:text-6xl font-semibold mb-8">
            There's more to discover.
          </h2>

          <Link
            to="/products"
            className="inline-flex items-center gap-4 border border-[#f3eee3]/20 px-7 py-4 text-xs tracking-[0.2em] uppercase rounded-sm hover:bg-[#f3eee3] hover:text-[#0b0a08] hover:border-[#f3eee3] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e3a857]/60 focus-visible:ring-offset-4 focus-visible:ring-offset-[#0b0a08]"
          >
            Browse everything
            <span>↗</span>
          </Link>
        </div>
      </section>
    </div>
  );
}