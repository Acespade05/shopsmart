const express = require('express');
const pool = require('../config/database');
const { getCart, saveCart, clearCart } = require('../services/cacheService');

const router = express.Router();

function cartOwnerId(req) {
  return req.user?.id ? `user:${req.user.id}` : `session:${req.sessionId}`;
}

// A cart line is one product in one size. `size` is optional: products
// without sizes (and older clients, like the traffic bot) simply omit it.
function normSize(size) {
  return size === undefined || size === null || size === '' ? null : String(size);
}

function sameLine(item, productId, size) {
  return item.productId === productId && (item.size ?? null) === size;
}

// GET /api/cart
router.get('/', async (req, res) => {
  try {
    const cart = await getCart(cartOwnerId(req));
    res.json({ cart });
  } catch (err) {
    console.error('Get cart error', err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// POST /api/cart/add
router.post('/add', async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const size = normSize(req.body.size);
    if (!productId) {
      return res.status(400).json({ error: 'productId is required' });
    }

    const productResult = await pool.query(
      'SELECT id, name, price, stock, images, sizes FROM products WHERE id = $1 AND is_active = true',
      [productId]
    );
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const product = productResult.rows[0];
    if (size && !(product.sizes || []).includes(size)) {
      return res.status(400).json({ error: `Size ${size} is not available for this product` });
    }

    const owner = cartOwnerId(req);
    const cart = await getCart(owner);

    const existing = cart.items.find((i) => sameLine(i, productId, size));
    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.items.push({
        productId: product.id,
        name: product.name,
        price: parseFloat(product.price),
        image: product.images?.[0] || null,
        quantity,
        ...(size ? { size } : {}),
      });
    }

    await saveCart(owner, cart);
    res.json({ cart });
  } catch (err) {
    console.error('Add to cart error', err);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
});

// PUT /api/cart/update
router.put('/update', async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const size = normSize(req.body.size);
    if (!productId || quantity === undefined) {
      return res.status(400).json({ error: 'productId and quantity are required' });
    }

    const owner = cartOwnerId(req);
    const cart = await getCart(owner);
    const item = cart.items.find((i) => sameLine(i, productId, size));

    if (!item) {
      return res.status(404).json({ error: 'Item not in cart' });
    }

    if (quantity <= 0) {
      cart.items = cart.items.filter((i) => !sameLine(i, productId, size));
    } else {
      item.quantity = quantity;
    }

    await saveCart(owner, cart);
    res.json({ cart });
  } catch (err) {
    console.error('Update cart error', err);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// DELETE /api/cart/remove/:productId[?size=M]
router.delete('/remove/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId, 10);
    const owner = cartOwnerId(req);
    const cart = await getCart(owner);

    // ?size=M removes just that size; without it, every line of the product is removed (old behaviour).
    if (req.query.size !== undefined) {
      const size = normSize(req.query.size);
      cart.items = cart.items.filter((i) => !sameLine(i, productId, size));
    } else {
      cart.items = cart.items.filter((i) => i.productId !== productId);
    }

    await saveCart(owner, cart);
    res.json({ cart });
  } catch (err) {
    console.error('Remove from cart error', err);
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// DELETE /api/cart/clear
router.delete('/clear', async (req, res) => {
  try {
    await clearCart(cartOwnerId(req));
    res.json({ cart: { items: [] } });
  } catch (err) {
    console.error('Clear cart error', err);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

module.exports = router;