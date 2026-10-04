import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { fallbackTo } from '../utils/images';

// Every offer here is real: the TIER discounts are applied automatically at
// checkout and WELCOME10 is a seeded discount code (see backend/seeds/run.js).
// If you change those in the backend, update the text here too.
const SLIDES = [
  {
    eyebrow: 'Automatic savings',
    title: ['Extra 15% off', 'orders above ₹2,000'],
    text: 'No code needed — applied at checkout. 10% off above ₹1,000 and 5% off above ₹500.',
    cta: 'Start shopping',
    to: '/products',
    imageQuery: { category: 'electronics', subcategory: 'Laptops', sort: 'popular', limit: 1 },
  },
  {
    eyebrow: 'Coupon',
    title: ['10% off with', 'code WELCOME10'],
    text: 'Enter WELCOME10 at checkout on any order. Watches, bags, jewellery and more.',
    cta: 'Shop accessories',
    to: '/category/accessories',
    imageQuery: { category: 'accessories', subcategory: "Men's Watches", sort: 'popular', limit: 1 },
  },
  {
    eyebrow: 'Bestselling books',
    title: ['Books from', '₹299'],
    text: 'Atomic Habits, The Psychology of Money, Wings of Fire and more.',
    cta: 'Browse books',
    to: '/category/books',
    imageQuery: { category: 'books', sort: 'popular', limit: 1 },
  },
];

const INTERVAL_MS = 6000;

export default function OfferCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [images, setImages] = useState({});

  // One product photo per slide, from the live catalog.
  useEffect(() => {
    SLIDES.forEach((slide, i) => {
      api
        .get('/products', { params: slide.imageQuery })
        .then((res) => {
          const p = res.data.products[0];
          if (p) setImages((prev) => ({ ...prev, [i]: { src: p.images?.[0], name: p.name } }));
        })
        .catch(() => {});
    });
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (paused || reduceMotion) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), INTERVAL_MS);
    return () => clearInterval(t);
  }, [paused]);

  const go = (delta) => setIndex((i) => (i + delta + SLIDES.length) % SLIDES.length);

  return (
    <section
      className="max-w-7xl mx-auto px-6 pt-16"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Offers"
    >
      <div className="relative overflow-hidden rounded-sm border border-[#f3eee3]/10 bg-[#14120f]">
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {SLIDES.map((slide, i) => (
            <div
              key={slide.eyebrow}
              className="relative w-full shrink-0 grid md:grid-cols-2 items-center min-h-[360px] md:min-h-[400px]"
              aria-hidden={i !== index}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(520px circle at 78% 50%, rgba(227,168,87,0.16), transparent 65%), radial-gradient(420px circle at 10% 90%, rgba(95,184,166,0.07), transparent 60%)',
                }}
              />

              <div className="relative z-10 px-8 md:px-14 py-12">
                <p className="font-mono text-[10px] tracking-[0.3em] text-[#e3a857] uppercase mb-5">{slide.eyebrow}</p>
                <h2 className="font-display text-4xl md:text-5xl font-semibold leading-[1.05] text-[#f3eee3]">
                  {slide.title[0]}
                  <br />
                  <span className="text-[#e3a857]">{slide.title[1]}</span>
                </h2>
                <p className="mt-5 max-w-sm text-sm leading-relaxed text-[#f3eee3]/50">{slide.text}</p>
                <Link
                  to={slide.to}
                  tabIndex={i === index ? 0 : -1}
                  className="inline-block mt-8 px-6 py-3 rounded-sm text-sm font-medium text-[#0b0a08] bg-gradient-to-r from-[#f0c07f] to-[#e3a857] hover:from-[#e3a857] hover:to-[#c98a34] transition-all"
                >
                  {slide.cta}
                </Link>
              </div>

              <div className="relative z-10 hidden md:flex items-center justify-center h-full py-10 pr-10">
                {images[i]?.src && (
                  <img
                    src={images[i].src}
                    alt={images[i].name}
                    className="max-h-[300px] max-w-[80%] object-contain drop-shadow-[0_25px_40px_rgba(0,0,0,0.6)]"
                    onError={fallbackTo(images[i].name)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="absolute bottom-5 left-8 md:left-14 z-20 flex items-center gap-2">
          {SLIDES.map((slide, i) => (
            <button
              key={slide.eyebrow}
              onClick={() => setIndex(i)}
              aria-label={`Show offer ${i + 1}`}
              aria-current={i === index}
              className={`h-[3px] rounded-full transition-all ${
                i === index ? 'w-8 bg-[#e3a857]' : 'w-4 bg-[#f3eee3]/20 hover:bg-[#f3eee3]/40'
              }`}
            />
          ))}
        </div>
        <div className="absolute bottom-4 right-5 z-20 hidden md:flex gap-2">
          <button
            onClick={() => go(-1)}
            aria-label="Previous offer"
            className="w-8 h-8 flex items-center justify-center border border-[#f3eee3]/15 text-[#f3eee3]/60 hover:border-[#e3a857] hover:text-[#e3a857] transition-colors rounded-sm"
          >
            ←
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Next offer"
            className="w-8 h-8 flex items-center justify-center border border-[#f3eee3]/15 text-[#f3eee3]/60 hover:border-[#e3a857] hover:text-[#e3a857] transition-colors rounded-sm"
          >
            →
          </button>
        </div>
      </div>

      {/* What every order gets — all true for this store */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px mt-6 border border-[#f3eee3]/10 bg-[#f3eee3]/10">
        {[
          ['Free delivery', 'On every order'],
          ['Up to 15% off', 'Applied automatically'],
          ['UPI, cards & netbanking', 'Secure checkout'],
          ['Track every order', 'From your Orders page'],
        ].map(([title, sub]) => (
          <div key={title} className="bg-[#0b0a08] px-5 py-4">
            <p className="text-xs font-medium text-[#f3eee3]/80">{title}</p>
            <p className="text-[11px] text-[#f3eee3]/35 mt-1">{sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
