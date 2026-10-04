#!/usr/bin/env python3
"""
Builds backend/seeds/catalog.json — the ShopSmart product catalog.

You do NOT need to run this to use the site: catalog.json is committed.
Re-run it only if you want to regenerate the catalog from source.

Sources
  * DummyJSON product dataset (MIT licence) — https://github.com/Ovi/DummyJSON
    Product titles, descriptions, brands, ratings, stock and multi-angle
    product photos (served from cdn.dummyjson.com).
  * Books: hand-written entries; covers load from Open Library by ISBN.

Usage
  git clone --depth 1 https://github.com/Ovi/DummyJSON /tmp/dummyjson
  python3 backend/scripts/build-catalog.py /tmp/dummyjson/database/products.json
"""
import hashlib
import json
import os
import re
import sys

SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/dummyjson/database/products.json'
OUT = os.path.join(os.path.dirname(__file__), '..', 'seeds', 'catalog.json')

# --------------------------------------------------------------------------
# Categories. Existing slugs (electronics, clothing, home-kitchen, books,
# sports) are kept so existing links, orders and the traffic bot keep working.
# --------------------------------------------------------------------------
CATEGORIES = [
    {'slug': 'electronics', 'name': 'Electronics', 'description': 'Smartphones, laptops, tablets, audio and smart devices.'},
    {'slug': 'clothing', 'name': 'Fashion', 'description': "Shirts, dresses and footwear for men and women."},
    {'slug': 'accessories', 'name': 'Watches & Accessories', 'description': 'Watches, handbags, jewellery and sunglasses.'},
    {'slug': 'home-kitchen', 'name': 'Home & Kitchen', 'description': 'Kitchen tools, appliances, furniture and home décor.'},
    {'slug': 'beauty', 'name': 'Beauty & Personal Care', 'description': 'Makeup, fragrances, and bath & body care.'},
    {'slug': 'groceries', 'name': 'Grocery', 'description': 'Fresh produce, dairy, staples, beverages and pet food.'},
    {'slug': 'sports', 'name': 'Sports & Fitness', 'description': 'Cricket, football, racket sports and more.'},
    {'slug': 'books', 'name': 'Books', 'description': 'Bestselling fiction, self-help, business and tech books.'},
]

# DummyJSON category -> (our category slug, subcategory, INR multiplier per USD)
CATEGORY_MAP = {
    'smartphones':         ('electronics', 'Smartphones', 83),
    'laptops':             ('electronics', 'Laptops', 83),
    'tablets':             ('electronics', 'Tablets', 83),
    'mobile-accessories':  ('electronics', 'Audio & Accessories', 80),
    'mens-shirts':         ('clothing', "Men's Shirts & T-Shirts", 40),
    'tops':                ('clothing', "Women's Dresses", 45),
    'womens-dresses':      ('clothing', "Women's Dresses", 45),
    'mens-shoes':          ('clothing', "Men's Footwear", 55),
    'womens-shoes':        ('clothing', "Women's Footwear", 50),
    'mens-watches':        ('accessories', "Men's Watches", 80),
    'womens-watches':      ('accessories', "Women's Watches", 80),
    'womens-bags':         ('accessories', 'Handbags & Backpacks', 60),
    'womens-jewellery':    ('accessories', 'Jewellery', 40),
    'sunglasses':          ('accessories', 'Sunglasses', 45),
    'kitchen-accessories': ('home-kitchen', 'Kitchen & Dining', 40),
    'furniture':           ('home-kitchen', 'Furniture', 75),
    'home-decoration':     ('home-kitchen', 'Home Décor', 45),
    'beauty':              ('beauty', 'Makeup', 45),
    'fragrances':          ('beauty', 'Fragrances', 75),
    'skin-care':           ('beauty', 'Bath & Body', 45),
    'groceries':           ('groceries', None, 35),
    'sports-accessories':  ('sports', None, 45),
}

# Products we leave out: vehicles aren't sold online; the rest don't suit an
# Indian general store.
EXCLUDE_CATEGORIES = {'vehicle', 'motorcycle'}
EXCLUDE_TITLES = {'Beef Steak', 'TV Studio Camera Pedestal'}

# Older phone models are listed as refurbished, the way real stores do.
RENEWED = {'iPhone 5s', 'iPhone 6', 'iPhone X', 'Samsung Galaxy S7', 'Samsung Galaxy S8'}

# Store-style titles for products whose source title is too generic.
TITLE_OVERRIDES = {
    # kitchen
    'Bamboo Spatula': 'Eco-Friendly Bamboo Cooking Spatula',
    'Black Aluminium Cup': 'Black Aluminium Coffee Cup, 350 ml',
    'Black Whisk': 'Stainless Steel Balloon Whisk, Black Handle',
    'Boxed Blender': 'Countertop Blender with 1.5 L Jar',
    'Carbon Steel Wok': 'Carbon Steel Wok, 30 cm',
    'Chopping Board': 'Wooden Chopping Board, Large',
    'Citrus Squeezer Yellow': 'Citrus Squeezer, Yellow',
    'Egg Slicer': 'Stainless Steel Egg Slicer',
    'Electric Stove': 'Electric Induction Cooktop, 2000 W',
    'Fine Mesh Strainer': 'Fine Mesh Kitchen Strainer, 20 cm',
    'Fork': 'Stainless Steel Dinner Fork',
    'Glass': 'Clear Drinking Glass, 300 ml',
    'Grater Black': 'Multi-Purpose Box Grater, Black',
    'Hand Blender': 'Hand Blender with Stainless Steel Wand',
    'Ice Cube Tray': 'Silicone Ice Cube Tray',
    'Kitchen Sieve': 'Kitchen Sieve with Handle',
    'Knife': "Chef's Knife, 8 inch",
    'Lunch Box': 'Insulated Lunch Box',
    'Microwave Oven': 'Solo Microwave Oven, 20 L',
    'Mug Tree Stand': 'Mug Tree Stand, Holds 6 Mugs',
    'Pan': 'Non-Stick Frying Pan, 24 cm',
    'Plate': 'Ceramic Dinner Plate, 27 cm',
    'Red Tongs': 'Silicone-Tipped Kitchen Tongs, Red',
    'Silver Pot With Glass Cap': 'Stainless Steel Cooking Pot with Glass Lid',
    'Slotted Turner': 'Slotted Turner Spatula',
    'Spice Rack': 'Rotating Spice Rack',
    'Spoon': 'Stainless Steel Table Spoon',
    'Tray': 'Wooden Serving Tray',
    'Wooden Rolling Pin': 'Wooden Rolling Pin (Belan)',
    'Yellow Peeler': 'Vegetable Peeler, Yellow',
    # home décor
    'Decoration Swing': 'Decorative Hanging Swing',
    'Family Tree Photo Frame': 'Family Tree Photo Frame',
    'House Showpiece Plant': 'Artificial Potted Plant Showpiece',
    'Plant Pot': 'Ceramic Plant Pot',
    'Table Lamp': 'Bedside Table Lamp',
    # groceries
    'Apple': 'Fresh Shimla Apples, 1 kg',
    'Chicken Meat': 'Fresh Chicken Curry Cut, 500 g',
    'Cooking Oil': 'Refined Sunflower Oil, 1 L',
    'Cucumber': 'Fresh Cucumber, 500 g',
    'Eggs': 'Farm Fresh Eggs, Pack of 12',
    'Fish Steak': 'Fresh Fish Steak, 500 g',
    'Green Bell Pepper': 'Green Capsicum, 250 g',
    'Green Chili Pepper': 'Green Chillies, 100 g',
    'Honey Jar': 'Pure Honey, 500 g',
    'Ice Cream': 'Vanilla Ice Cream Tub, 1 L',
    'Juice': 'Mixed Fruit Juice, 1 L',
    'Kiwi': 'Fresh Kiwi, Pack of 3',
    'Lemon': 'Fresh Lemons, 250 g',
    'Milk': 'Toned Milk, 1 L',
    'Mulberry': 'Fresh Mulberries, 200 g',
    'Nescafe Coffee': 'Nescafé Classic Instant Coffee, 100 g',
    'Potatoes': 'Potatoes, 1 kg',
    'Protein Powder': 'Whey Protein Powder, 1 kg',
    'Red Onions': 'Red Onions, 1 kg',
    'Rice': 'Basmati Rice, 5 kg',
    'Soft Drinks': 'Soft Drink, Pack of 6 Cans',
    'Strawberry': 'Fresh Strawberries, 200 g',
    'Tissue Paper Box': 'Facial Tissue Box, 200 Pulls',
    'Water': 'Packaged Drinking Water, 1 L',
    'Cat Food': 'Dry Cat Food, 1.2 kg',
    'Dog Food': 'Dry Dog Food, 3 kg',
    # sports
    'American Football': 'American Football, Official Size',
    'Baseball Ball': 'Baseball, Leather',
    'Basketball': 'Basketball, Size 7',
    'Basketball Rim': 'Wall-Mounted Basketball Rim with Net',
    'Cricket Ball': 'Leather Cricket Ball, Red',
    'Cricket Bat': 'Kashmir Willow Cricket Bat',
    'Cricket Helmet': 'Cricket Helmet with Steel Grille',
    'Cricket Wicket': 'Cricket Stumps Set with Bails',
    'Feather Shuttlecock': 'Feather Shuttlecocks, Pack of 6',
    'Football': 'Football, Size 5',
    'Golf Ball': 'Golf Balls, Pack of 3',
    'Iron Golf': 'Golf Iron Club',
    'Tennis Ball': 'Tennis Balls, Pack of 3',
    'Tennis Racket': 'Graphite Tennis Racket',
    # fashion / accessories
    'Blue Frock': "Women's Blue Flared Frock",
    'Girl Summer Dress': "Women's Floral Summer Dress",
    'Gray Dress': "Women's Grey Midi Dress",
    'Short Frock': "Women's Short Frock",
    'Tartan Dress': "Women's Tartan Check Dress",
    'Dress Pea': "Women's Polka Dot Dress",
    'Man Plaid Shirt': "Men's Plaid Casual Shirt",
    'Man Short Sleeve Shirt': "Men's Short Sleeve Shirt",
    'Men Check Shirt': "Men's Check Shirt",
    'Gigabyte Aorus Men Tshirt': 'Gigabyte AORUS Men\'s Gaming T-Shirt',
    'Black & Brown Slipper': "Women's Black & Brown Slippers",
    'Golden Shoes Woman': "Women's Golden Party Heels",
    'Red Shoes': "Women's Red Pumps",
    'Pampi Shoes': "Pampi Women's Casual Shoes",
    'Sunglasses': 'Classic Aviator Sunglasses',
    'Black Sun Glasses': 'Black Wayfarer Sunglasses',
    'Classic Sun Glasses': 'Classic Round Sunglasses',
    'Green and Black Glasses': 'Green & Black Sports Sunglasses',
    'Party Glasses': 'Party Novelty Sunglasses',
    "Women's Wrist Watch": "Women's Analog Wrist Watch",
    'Watch Gold for Women': "Women's Gold-Tone Analog Watch",
    'Green Crystal Earring': 'Green Crystal Drop Earrings',
    'Green Oval Earring': 'Green Oval Drop Earrings',
    'Tropical Earring': 'Tropical Statement Earrings',
    'New DELL XPS 13 9300 Laptop': 'Dell XPS 13 9300 Laptop',
    'Marni Red & Black Suit': "Women's Red & Black Two-Piece Suit",
    # fragrances (source titles are truncated)
    'Chanel Coco Noir Eau De': 'Chanel Coco Noir Eau de Parfum, 100 ml',
    "Dior J'adore": "Dior J'adore Eau de Parfum, 100 ml",
    'Dolce Shine Eau de': 'Dolce & Gabbana Dolce Shine Eau de Parfum, 75 ml',
    'Gucci Bloom Eau de': 'Gucci Bloom Eau de Parfum, 100 ml',
    'Calvin Klein CK One': 'Calvin Klein CK One Eau de Toilette, 100 ml',
}

# Fictional house brands for unbranded source products.
HOUSE_BRAND = {
    'kitchen-accessories': 'HomeCraft', 'home-decoration': 'Nest & Co.',
    'groceries': 'FreshBasket', 'sports-accessories': 'Stride Sports',
    'tops': 'Urban Thread', 'womens-dresses': 'Urban Thread',
    'womens-jewellery': 'Aura Jewels',
}
# Groceries that are real brands in their own right.
GROCERY_BRANDS = {'Nescafe Coffee': 'Nescafé'}

GROCERY_SUB = {
    'Fruits & Vegetables': ['Apple', 'Cucumber', 'Green Bell Pepper', 'Green Chili Pepper', 'Kiwi', 'Lemon', 'Mulberry', 'Potatoes', 'Red Onions', 'Strawberry'],
    'Dairy, Eggs & Frozen': ['Eggs', 'Milk', 'Ice Cream'],
    'Meat & Fish': ['Chicken Meat', 'Fish Steak'],
    'Beverages': ['Juice', 'Nescafe Coffee', 'Soft Drinks', 'Water'],
    'Staples & Pantry': ['Cooking Oil', 'Honey Jar', 'Rice', 'Protein Powder'],
    'Pet Supplies': ['Cat Food', 'Dog Food'],
    'Household': ['Tissue Paper Box'],
}
SPORTS_SUB = {
    'Cricket': ['Cricket Ball', 'Cricket Bat', 'Cricket Helmet', 'Cricket Wicket'],
    'Football & Basketball': ['Football', 'American Football', 'Basketball', 'Basketball Rim', 'Volleyball'],
    'Racket Sports': ['Tennis Ball', 'Tennis Racket', 'Feather Shuttlecock'],
    'Baseball & Golf': ['Baseball Ball', 'Baseball Glove', 'Metal Baseball Bat', 'Golf Ball', 'Iron Golf'],
}
APPLIANCES = {'Boxed Blender', 'Electric Stove', 'Hand Blender', 'Microwave Oven'}
WEARABLES = {'Apple Watch Series 4 Gold'}

SIZES = {
    'mens-shirts': ['S', 'M', 'L', 'XL', 'XXL'],
    'tops': ['XS', 'S', 'M', 'L', 'XL'],
    'womens-dresses': ['XS', 'S', 'M', 'L', 'XL'],
    'mens-shoes': ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'],
    'womens-shoes': ['UK 3', 'UK 4', 'UK 5', 'UK 6', 'UK 7'],
}


def policies(src_cat, title, our_cat):
    """(warranty, return_policy) that match how Indian stores list them."""
    if our_cat == 'electronics':
        return '1 Year Manufacturer Warranty', '7 Days Replacement'
    if src_cat in ('mens-watches', 'womens-watches'):
        return '2 Year Manufacturer Warranty', '10 Days Return'
    if our_cat in ('clothing', 'accessories'):
        return None, '10 Days Return & Exchange'
    if title in APPLIANCES:
        return '1 Year Warranty', '7 Days Replacement'
    if src_cat == 'furniture':
        return '1 Year Warranty', '10 Days Return'
    if our_cat in ('beauty', 'groceries'):
        return None, 'Non-returnable'
    if our_cat == 'books':
        return None, '7 Days Replacement'
    return None, '7 Days Return'


def inr(x):
    """Round to the price points real Indian stores use (₹149, ₹1,299, ₹24,999)."""
    if x < 1000:
        return max(19, int(round(x / 10.0)) * 10 - 1)
    if x < 10000:
        return int(round(x / 50.0)) * 50 - 1
    return int(round(x / 500.0)) * 500 - 1


def h(s, lo, hi):
    """Deterministic number in [lo, hi] from a string, so re-runs give the same catalog."""
    n = int(hashlib.md5(s.encode()).hexdigest()[:8], 16)
    return lo + n % (hi - lo + 1)


def slugify(s):
    s = s.lower().replace('&', 'and').replace("'", '')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def rescale_rating(r):
    # Source ratings run 2.5–5.0; real store listings cluster 3.5–4.8.
    return round(3.5 + (max(2.5, min(5.0, r)) - 2.5) / 2.5 * 1.3, 1)


def main():
    src = json.load(open(SRC))
    products = []
    for p in src:
        sc = p['category']
        if sc in EXCLUDE_CATEGORIES or p['title'] in EXCLUDE_TITLES:
            continue
        cat, sub, rate = CATEGORY_MAP[sc]
        t = p['title']
        if sc == 'groceries':
            sub = next(k for k, v in GROCERY_SUB.items() if t in v)
        if sc == 'sports-accessories':
            sub = next(k for k, v in SPORTS_SUB.items() if t in v)
        if t in WEARABLES:
            sub = 'Smartwatches & Wearables'
        if sc == 'mobile-accessories' and ('Echo' in t or 'HomePod' in t):
            sub = 'Smart Home'

        brand = GROCERY_BRANDS.get(t) or p.get('brand') or HOUSE_BRAND.get(sc)
        title = TITLE_OVERRIDES.get(t, t)
        if sc == 'womens-watches' and t == 'Rolex Cellini Moonphase':
            title = "Rolex Cellini Moonphase Women's Watch"
        if t in RENEWED:
            title = f'{title} (Renewed)'
        if brand and sc in ('smartphones', 'tablets', 'mobile-accessories') and not title.lower().startswith(brand.lower()):
            title = f'{brand} {title}'

        price = inr(p['price'] * rate)
        disc = p.get('discountPercentage') or 0
        original = inr(price / (1 - disc / 100.0)) if disc >= 5 else None
        if original is not None and original <= price:
            original = None

        warranty, returns = policies(sc, t, cat)
        specs = {}
        if brand:
            specs['Brand'] = brand
        specs['Model / SKU'] = p['sku']
        if sub:
            specs['Type'] = sub
        if warranty:
            specs['Warranty'] = warranty

        products.append({
            'slug': slugify(title),
            'name': title,
            'brand': brand,
            'category': cat,
            'subcategory': sub,
            'description': p['description'],
            'price': price,
            'original_price': original,
            'stock': max(8, p['stock']),           # never 0: keeps bot add-to-cart behaving as before
            'images': p['images'],
            'rating': rescale_rating(p['rating']),
            'review_count': h(p['sku'], 40, 4800),
            'sku': p['sku'],
            'tags': p.get('tags', []),
            'specs': specs,
            'sizes': SIZES.get(sc, []),
            'warranty': warranty,
            'return_policy': returns,
            'shipping_info': 'Usually delivered in 2–4 days' if 'ships in 1' in p['shippingInformation'].lower() or 'overnight' in p['shippingInformation'].lower() else 'Usually delivered in 4–7 days',
        })

    products += books()

    slugs = [p['slug'] for p in products]
    dupes = {s for s in slugs if slugs.count(s) > 1}
    assert not dupes, f'duplicate slugs: {dupes}'

    out = {
        'generated_by': 'backend/scripts/build-catalog.py',
        'sources': ['DummyJSON (MIT) https://github.com/Ovi/DummyJSON', 'Open Library Covers API (book covers by ISBN)'],
        'categories': CATEGORIES,
        'products': products,
    }
    with open(OUT, 'w') as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    from collections import Counter
    print(f'Wrote {len(products)} products to {os.path.normpath(OUT)}')
    print(dict(Counter(p['category'] for p in products)))


BOOKS = [
    # isbn, title, author, publisher, genre, price, mrp, rating, description
    ('9780735211292', 'Atomic Habits', 'James Clear', 'Avery', 'Self-Help', 499, 799, 4.7,
     'A practical framework for building good habits and breaking bad ones, showing how tiny changes compound into remarkable results.'),
    ('9781250301697', 'The Silent Patient', 'Alex Michaelides', 'Celadon Books', 'Thriller', 399, 599, 4.4,
     'A psychological thriller about a painter who shoots her husband and never speaks again, and the psychotherapist determined to uncover why.'),
    ('9780062316097', 'Sapiens: A Brief History of Humankind', 'Yuval Noah Harari', 'Harper', 'History', 549, 899, 4.6,
     'A sweeping account of how Homo sapiens came to dominate the planet, from the cognitive revolution to the present day.'),
    ('9780132350884', 'Clean Code', 'Robert C. Martin', 'Prentice Hall', 'Programming', 699, 1099, 4.6,
     'A handbook of agile software craftsmanship covering naming, functions, error handling and refactoring toward readable, maintainable code.'),
    ('9780062315007', 'The Alchemist', 'Paulo Coelho', 'HarperOne', 'Fiction', 299, 450, 4.5,
     'A shepherd boy travels from Spain to the Egyptian desert in search of treasure, in this fable about following your dreams.'),
    ('9781612680194', 'Rich Dad Poor Dad', 'Robert T. Kiyosaki', 'Plata Publishing', 'Personal Finance', 349, 499, 4.5,
     'Lessons on money, assets and financial independence, told through the contrast between the author\'s two father figures.'),
    ('9781455586691', 'Deep Work', 'Cal Newport', 'Grand Central Publishing', 'Productivity', 449, 699, 4.5,
     'An argument for focused, distraction-free work as a rare and valuable skill, with rules for training your concentration.'),
    ('9780143130727', 'Ikigai: The Japanese Secret to a Long and Happy Life', 'Héctor García & Francesc Miralles', 'Penguin Books', 'Self-Help', 349, 550, 4.4,
     'An exploration of the Japanese idea of ikigai — a reason for being — drawing on the habits of Okinawa\'s long-lived residents.'),
    ('9780857197689', 'The Psychology of Money', 'Morgan Housel', 'Harriman House', 'Personal Finance', 349, 499, 4.7,
     'Short stories about how people think about money, and why behaviour matters more than knowledge in building wealth.'),
    ('9780804139298', 'Zero to One', 'Peter Thiel with Blake Masters', 'Crown Business', 'Business', 449, 699, 4.4,
     'Notes on startups and how to build companies that create genuinely new things rather than copying what already works.'),
    ('9788173711466', 'Wings of Fire: An Autobiography', 'A. P. J. Abdul Kalam with Arun Tiwari', 'Universities Press', 'Biography', 299, 399, 4.7,
     'The autobiography of India\'s former President, tracing his journey from Rameswaram to leading India\'s missile programme.'),
    ('9781416562603', 'The White Tiger', 'Aravind Adiga', 'Free Press', 'Fiction', 349, 499, 4.2,
     'A darkly comic novel narrated by a driver from rural India who rises to become an entrepreneur in Bangalore. Winner of the 2008 Booker Prize.'),
]


def books():
    out = []
    for isbn, title, author, pub, genre, price, mrp, rating, desc in BOOKS:
        out.append({
            'slug': slugify(title),
            'name': title,
            'brand': pub,
            'category': 'books',
            'subcategory': genre,
            'description': desc,
            'price': price,
            'original_price': mrp,
            'stock': h(isbn, 25, 180),
            # default=false makes Open Library return 404 (not a blank image) if a cover is missing,
            # so the frontend's placeholder fallback kicks in.
            'images': [f'https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg?default=false'],
            'rating': rating,
            'review_count': h(isbn, 150, 2600),
            'sku': f'BK-{isbn}',
            'tags': ['books', genre.lower()],
            'specs': {'Author': author, 'Publisher': pub, 'Genre': genre, 'Language': 'English', 'ISBN-13': isbn},
            'sizes': [],
            'warranty': None,
            'return_policy': '7 Days Replacement',
            'shipping_info': 'Usually delivered in 2–4 days',
        })
    return out


if __name__ == '__main__':
    main()
