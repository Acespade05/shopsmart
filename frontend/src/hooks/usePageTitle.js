import { useEffect } from 'react';

// Sets the browser tab title, e.g. "Apple iPhone 13 Pro | ShopSmart".
// Pass nothing (or a falsy value while data loads) for just "ShopSmart".
export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | ShopSmart` : 'ShopSmart — Everything you need';
  }, [title]);
}
