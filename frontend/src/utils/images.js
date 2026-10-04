// Fallback product image, drawn inline as an SVG so it needs no network
// request and can never fail to load itself.
export function placeholder(name = '') {
  const text = String(name).replace(/[<>&"']/g, '').slice(0, 40);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">` +
    `<rect width="500" height="500" fill="#14120f"/>` +
    `<text x="250" y="250" fill="#e3a857" fill-opacity="0.7" font-family="sans-serif" font-size="22" ` +
    `text-anchor="middle" dominant-baseline="middle">${text}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// onError handler for <img>: swap in the placeholder once, never loop.
export function fallbackTo(name) {
  return (e) => {
    const img = e.currentTarget;
    if (img.dataset.fallback) return;
    img.dataset.fallback = '1';
    img.src = placeholder(name);
  };
}
