import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { products as allProducts } from '../data/products';

export default function ProductList() {
  const [searchParams, setSearchParams] = useSearchParams();

  const sort = searchParams.get('sort') || 'newest';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const inStock = searchParams.get('inStock') === 'true';

  const products = useMemo(() => {
    let filtered = [...allProducts];

    // -------------------------
    // PRICE FILTER
    // -------------------------
    if (minPrice) {
      filtered = filtered.filter(
        (product) => Number(product.price) >= Number(minPrice)
      );
    }

    if (maxPrice) {
      filtered = filtered.filter(
        (product) => Number(product.price) <= Number(maxPrice)
      );
    }

    // -------------------------
    // STOCK FILTER
    // -------------------------
    if (inStock) {
      filtered = filtered.filter(
        (product) => Number(product.stock) > 0
      );
    }

    // -------------------------
    // SORT
    // -------------------------
    if (sort === 'price_asc') {
      filtered.sort(
        (a, b) => Number(a.price) - Number(b.price)
      );
    }

    if (sort === 'price_desc') {
      filtered.sort(
        (a, b) => Number(b.price) - Number(a.price)
      );
    }

    if (sort === 'rating') {
      filtered.sort(
        (a, b) => Number(b.rating) - Number(a.rating)
      );
    }

    // Keep newest/default order otherwise

    return filtered;
  }, [sort, minPrice, maxPrice, inStock]);

  function updateParam(key, value) {
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
              All products.
            </h1>

            <p className="mt-5 text-sm text-[#f3eee3]/40 max-w-md">
              Everything in one place. Browse, filter, and find something
              worth taking home.
            </p>
          </div>

          <span className="hidden md:block font-mono text-[10px] tracking-[0.2em] text-[#f3eee3]/30">
            {String(products.length).padStart(2, '0')} ITEMS
          </span>

        </div>
      </section>


      {/* =========================
          CONTENT
      ========================== */}

      <section className="max-w-7xl mx-auto px-6 pb-32">

        <div className="h-px bg-[#f3eee3]/10 mb-10" />

        <div className="flex gap-12">

          {/* =========================
              FILTERS
          ========================== */}

          <aside className="w-52 shrink-0 space-y-10">

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
                <option value="newest" className="bg-[#0b0a08]">
                  Newest
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

          <div className="flex-1">

            {products.length === 0 ? (

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

          </div>

        </div>

      </section>

    </div>
  );
}