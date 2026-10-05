import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import api from '../services/api';

const PAGE_SIZE = 24;

export default function ProductList() {
  const [searchParams, setSearchParams] = useSearchParams();

  const sort = searchParams.get('sort') || 'popular';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const inStock = searchParams.get('inStock') === 'true';
  const category = searchParams.get('category') || '';
  const brand = searchParams.get('brand') || '';

  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data.categories)).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = { sort, page, limit: PAGE_SIZE };
    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;
    if (inStock) params.inStock = 'true';
    if (category) params.category = category;
    if (brand) params.brand = brand;

    api
      .get('/products', { params })
      .then((res) => {
        if (cancelled) return;
        setTotal(res.data.pagination.total);
        setProducts((prev) => (page === 1 ? res.data.products : [...prev, ...res.data.products]));
      })
      .catch(() => {
        if (!cancelled && page === 1) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sort, minPrice, maxPrice, inStock, category, brand, page]);

  function updateParam(key, value) {
    setPage(1); // any filter change starts again from page 1

    const next = new URLSearchParams(searchParams);

    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }

    setSearchParams(next);
  }

  return (
    <div className="min-h-screen bg-[#0b0a08] text-[#f3eee3]">

      {/* =========================
          HEADER
      ========================== */}

      <section className="relative max-w-7xl mx-auto px-6 pt-24 pb-14">

        <div className="absolute top-0 left-6 right-6 h-px bg-[#f3eee3]/10" />

        <div className="flex items-end justify-between">

          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] text-[#e3a857] uppercase mb-4">
              The collection
            </p>

            <h1 className="font-display text-5xl md:text-7xl font-semibold leading-none">
              {brand ? `${brand}.` : 'All products.'}
            </h1>
            {brand && (
              <button
                onClick={() => updateParam('brand', '')}
                className="mt-4 text-xs text-[#e3a857] hover:text-[#f0c07f]"
              >
                ✕ Clear brand filter
              </button>
            )}

            <p className="mt-5 text-sm text-[#f3eee3]/40 max-w-md">
              Everything in one place. Browse, filter, and find something
              worth taking home.
            </p>
          </div>

          <span className="hidden md:block font-mono text-[10px] tracking-[0.2em] text-[#f3eee3]/30">
            {String(total).padStart(2, '0')} ITEMS
          </span>

        </div>
      </section>


      {/* =========================
          CONTENT
      ========================== */}

      <section className="max-w-7xl mx-auto px-6 pb-32">

        <div className="h-px bg-[#f3eee3]/10 mb-10" />

        <div className="flex flex-col md:flex-row gap-10 md:gap-12">

          {/* =========================
              FILTERS
          ========================== */}

          <aside className="w-full md:w-52 shrink-0 space-y-8 md:space-y-10">

            {/* Category */}
            <div>
              <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#e3a857] mb-4">
                Category
              </p>

              <div className="space-y-2">
                {[{ slug: '', name: 'All products' }, ...categories].map((c) => (
                  <button
                    key={c.slug || 'all'}
                    onClick={() => updateParam('category', c.slug)}
                    className={`block w-full text-left text-xs py-1 transition-colors ${
                      category === c.slug ? 'text-[#e3a857]' : 'text-[#f3eee3]/50 hover:text-[#f3eee3]'
                    }`}
                  >
                    {c.name}
                    {c.product_count !== undefined && (
                      <span className="ml-2 text-[#f3eee3]/25">{c.product_count}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div>
              <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#e3a857] mb-4">
                Sort
              </p>

              <select
                value={sort}
                onChange={(e) =>
                  updateParam('sort', e.target.value)
                }
                className="
                  w-full
                  bg-transparent
                  border border-[#f3eee3]/15
                  text-[#f3eee3]
                  text-xs
                  px-3
                  py-3
                  outline-none
                  focus:border-[#e3a857]/60
                "
              >
                <option value="popular" className="bg-[#0b0a08]">
                  Popularity
                </option>

                <option value="newest" className="bg-[#0b0a08]">
                  Newest
                </option>

                <option value="discount" className="bg-[#0b0a08]">
                  Biggest Discount
                </option>

                <option value="price_asc" className="bg-[#0b0a08]">
                  Price: Low to High
                </option>

                <option value="price_desc" className="bg-[#0b0a08]">
                  Price: High to Low
                </option>

                <option value="rating" className="bg-[#0b0a08]">
                  Highest Rated
                </option>
              </select>
            </div>


            {/* Price */}
            <div>
              <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#e3a857] mb-4">
                Price range
              </p>

              <div className="flex gap-2">

                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) =>
                    updateParam('minPrice', e.target.value)
                  }
                  className="
                    w-1/2
                    bg-transparent
                    border border-[#f3eee3]/15
                    px-3
                    py-3
                    text-xs
                    text-[#f3eee3]
                    outline-none
                    focus:border-[#e3a857]/60
                  "
                />

                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) =>
                    updateParam('maxPrice', e.target.value)
                  }
                  className="
                    w-1/2
                    bg-transparent
                    border border-[#f3eee3]/15
                    px-3
                    py-3
                    text-xs
                    text-[#f3eee3]
                    outline-none
                    focus:border-[#e3a857]/60
                  "
                />

              </div>
            </div>


            {/* Stock */}
            <label className="flex items-center gap-3 text-xs text-[#f3eee3]/60 cursor-pointer">

              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) =>
                  updateParam(
                    'inStock',
                    e.target.checked ? 'true' : ''
                  )
                }
                className="accent-[#e3a857]"
              />

              In stock only

            </label>

          </aside>


          {/* =========================
              PRODUCTS
          ========================== */}

          <div className="flex-1 min-w-0">

            {!loading && products.length === 0 ? (

              <div className="py-24 text-center">

                <p className="font-display text-3xl text-[#f3eee3]/30">
                  Nothing matches.
                </p>

                <p className="text-xs text-[#f3eee3]/20 mt-3">
                  Try changing your filters.
                </p>

              </div>

            ) : (

              <div className="
                grid
                grid-cols-2
                md:grid-cols-3
                gap-x-8
                gap-y-16

                [&_.bg-emerald-light]:!bg-[#14120f]
                [&_.text-ink]:!text-[#f3eee3]
                [&_.text-ink\/60]:!text-[#f3eee3]/50
                [&_.text-ink\/40]:!text-[#f3eee3]/30
                [&_.text-ink\/20]:!text-[#f3eee3]/20
              ">

                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                  />
                ))}

              </div>

            )}

            {products.length < total && (
              <div className="mt-16 text-center">
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={loading}
                  className="border border-[#f3eee3]/20 px-7 py-3 text-xs tracking-[0.2em] uppercase rounded-sm hover:bg-[#f3eee3] hover:text-[#0b0a08] transition-all disabled:opacity-40"
                >
                  {loading ? 'Loading…' : `Show more (${total - products.length} left)`}
                </button>
              </div>
            )}

            {loading && products.length === 0 && (
              <p className="py-24 text-center text-xs text-[#f3eee3]/30">Loading products…</p>
            )}

          </div>

        </div>

      </section>

    </div>
  );
}