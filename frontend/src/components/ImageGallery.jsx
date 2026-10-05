import { useEffect, useState } from 'react';
import { fallbackTo, placeholder } from '../utils/images';

// Product images: thumbnails, hover-to-zoom on the main image, click for full screen.
export default function ImageGallery({ images, name }) {
  const list = images.length ? images : [placeholder(name)];
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(null); // {x, y} in % while hovering
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    setActive(0);
  }, [images]);

  useEffect(() => {
    if (!fullscreen) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') setFullscreen(false);
      if (e.key === 'ArrowRight') setActive((i) => (i + 1) % list.length);
      if (e.key === 'ArrowLeft') setActive((i) => (i - 1 + list.length) % list.length);
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [fullscreen, list.length]);

  const src = list[active] || list[0];

  return (
    <div className="flex flex-col-reverse lg:flex-row gap-4">
      {list.length > 1 && (
        <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-visible">
          {list.map((img, i) => (
            <button
              key={img}
              onClick={() => setActive(i)}
              onMouseEnter={() => setActive(i)}
              aria-label={`Show image ${i + 1}`}
              className={`shrink-0 w-16 h-16 lg:w-20 lg:h-20 rounded-sm overflow-hidden bg-[#14120f] border transition-colors ${
                i === active ? 'border-[#e3a857]' : 'border-[#f3eee3]/10 hover:border-[#f3eee3]/40'
              }`}
            >
              <img src={img} alt="" className="w-full h-full object-contain p-1.5" onError={fallbackTo(name)} />
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
          }}
          onMouseLeave={() => setZoom(null)}
          aria-label="View full screen"
          className="relative block w-full aspect-square bg-[#14120f] rounded-sm overflow-hidden cursor-zoom-in"
        >
          <img
            src={src}
            alt={name}
            onError={fallbackTo(name)}
            className="w-full h-full object-contain p-8 transition-transform duration-150 ease-out"
            style={zoom ? { transform: 'scale(2)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          />
          <span className="absolute bottom-3 right-3 text-[10px] tracking-[0.15em] uppercase text-[#f3eee3]/30 pointer-events-none">
            Hover to zoom · click to expand
          </span>
        </button>
      </div>

      {fullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${name} images`}
          className="fixed inset-0 z-[100] bg-[#0b0a08]/95 flex items-center justify-center"
          onClick={() => setFullscreen(false)}
        >
          <img
            src={src}
            alt={name}
            onError={fallbackTo(name)}
            className="max-w-[90vw] max-h-[85vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setFullscreen(false)}
            aria-label="Close"
            className="absolute top-5 right-6 text-3xl text-[#f3eee3]/60 hover:text-[#f3eee3]"
          >
            ×
          </button>
          {list.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActive((i) => (i - 1 + list.length) % list.length);
                }}
                aria-label="Previous image"
                className="absolute left-4 md:left-10 w-11 h-11 border border-[#f3eee3]/20 text-[#f3eee3]/70 hover:border-[#e3a857] hover:text-[#e3a857] rounded-sm"
              >
                ←
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActive((i) => (i + 1) % list.length);
                }}
                aria-label="Next image"
                className="absolute right-4 md:right-10 w-11 h-11 border border-[#f3eee3]/20 text-[#f3eee3]/70 hover:border-[#e3a857] hover:text-[#e3a857] rounded-sm"
              >
                →
              </button>
              <p className="absolute bottom-6 text-xs font-mono text-[#f3eee3]/40">
                {active + 1} / {list.length}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
