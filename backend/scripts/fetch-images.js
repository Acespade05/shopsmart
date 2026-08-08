// One-time script: fetches a real, relevant photo URL per product from
// Pexels and saves them to seeds/product-images.json. Run once locally;
// the seed script then reads from that file — no live API dependency
// at seed/runtime after this.
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
if (!PEXELS_API_KEY) {
  console.error('PEXELS_API_KEY is not set in .env');
  process.exit(1);
}

const productKeywords = {
  'Wireless Bluetooth Earbuds': 'wireless earbuds',
  'Smartphone 128GB': 'smartphone',
  '27-inch 4K Monitor': 'computer monitor',
  'Mechanical Keyboard': 'mechanical keyboard',
  'Wireless Mouse': 'computer mouse',
  'Portable Power Bank 20000mAh': 'power bank charger',
  'Smart Watch Series 5': 'smart watch',
  'Noise Cancelling Headphones': 'headphones',
  'USB-C Hub 7-in-1': 'usb hub',
  'Bluetooth Speaker Waterproof': 'bluetooth speaker',
  '1TB Portable SSD': 'external hard drive',
  'Laptop Stand Aluminium': 'laptop stand',
  "Men's Cotton T-Shirt": 'mens t-shirt',
  "Women's Denim Jacket": 'denim jacket',
  "Men's Slim Fit Jeans": 'mens jeans',
  "Women's Kurti Set": 'indian kurti dress',
  'Unisex Hoodie': 'hoodie',
  "Men's Formal Shirt": 'formal shirt',
  "Women's Yoga Pants": 'yoga pants',
  "Kids' Graphic T-Shirt": 'kids t-shirt',
  "Men's Running Shorts": 'running shorts',
  "Women's Cardigan": 'cardigan sweater',
  'Non-Stick Frying Pan': 'frying pan',
  'Electric Kettle 1.5L': 'electric kettle',
  'Air Fryer 4L': 'air fryer',
  'Stainless Steel Cookware Set': 'cookware set',
  'Ceramic Dinner Set 16pc': 'ceramic dinner set',
  'Memory Foam Pillow': 'pillow',
  'Cotton Bedsheet Set': 'bedsheet',
  'LED Desk Lamp': 'desk lamp',
  'Vacuum Flask 1L': 'thermos flask',
  'Kitchen Knife Set': 'kitchen knife set',
  'Atomic Habits': 'open book',
  'The Silent Patient': 'open book',
  'Sapiens: A Brief History': 'open book',
  'Clean Code': 'open book',
  'The Alchemist': 'open book',
  'Rich Dad Poor Dad': 'open book',
  'Deep Work': 'open book',
  Ikigai: 'open book',
  'The Psychology of Money': 'open book',
  'Zero to One': 'open book',
  'Football Size 5': 'soccer ball',
  'Yoga Mat 6mm': 'yoga mat',
  'Adjustable Dumbbell Set': 'dumbbells',
  'Cricket Bat Kashmir Willow': 'cricket bat',
  'Running Shoes': 'running shoes',
  'Resistance Bands Set': 'resistance bands',
  'Badminton Racket Pair': 'badminton racket',
  'Skipping Rope': 'jump rope',
  'Cycling Helmet': 'cycling helmet',
  'Table Tennis Paddle Set': 'ping pong paddle',
};

async function fetchImageFor(query) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`;
  const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
  if (!res.ok) {
    console.error(`Pexels error for "${query}": ${res.status}`);
    return null;
  }
  const data = await res.json();
  return data.photos?.[0]?.src?.medium || null;
}

async function main() {
  const results = {};
  const entries = Object.entries(productKeywords);

  for (const [productName, query] of entries) {
    process.stdout.write(`Fetching: ${productName}... `);
    const url = await fetchImageFor(query);
    if (url) {
      results[productName] = url;
      console.log('OK');
    } else {
      console.log('FAILED');
    }
    // Pexels free tier: 200 requests/hour — small delay to be safe
    await new Promise((r) => setTimeout(r, 300));
  }

  const outPath = path.join(__dirname, '..', 'seeds', 'product-images.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nSaved ${Object.keys(results).length} image URLs to ${outPath}`);
}

main();