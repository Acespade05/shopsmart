-- ShopSmart initial schema
-- AI-SRE Patient Application

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- users
-- ============================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- bcrypt hashed
    role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    phone VARCHAR(20),
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- categories
-- ============================================================
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    image_url VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================
-- products
-- ============================================================
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    original_price DECIMAL(10,2),
    stock INTEGER NOT NULL DEFAULT 0,
    images TEXT[] DEFAULT '{}',
    rating DECIMAL(3,2) DEFAULT 0.00,
    review_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_active ON products(is_active);

-- ============================================================
-- sessions  (feeds business-metrics: active_sessions)
-- ============================================================
CREATE TABLE sessions (
    id VARCHAR(100) PRIMARY KEY, -- UUID
    user_id INTEGER REFERENCES users(id),
    last_active TIMESTAMP NOT NULL DEFAULT now(),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    ip_address VARCHAR(45),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_last_active ON sessions(last_active);
CREATE INDEX idx_sessions_status ON sessions(status);

-- ============================================================
-- carts  (feeds business-metrics: active_checkouts)
-- ============================================================
CREATE TABLE carts (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) REFERENCES sessions(id),
    user_id INTEGER REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'checkout', 'completed', 'abandoned')),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_carts_session ON carts(session_id);
CREATE INDEX idx_carts_status ON carts(status);

-- ============================================================
-- addresses
-- ============================================================
CREATE TABLE addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    line1 VARCHAR(255) NOT NULL,
    line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_addresses_user ON addresses(user_id);

-- ============================================================
-- orders  (feeds business-metrics: revenue_today, aov, conversion_rate)
-- ============================================================
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    session_id VARCHAR(100),
    total DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'paid', 'failed')),
    payment_method VARCHAR(50),
    address_id INTEGER REFERENCES addresses(id),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_orders_status ON orders(status);

-- ============================================================
-- order_items
-- ============================================================
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(10,2) NOT NULL -- price at time of purchase
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ============================================================
-- reviews
-- ============================================================
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title VARCHAR(200),
    body TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE(product_id, user_id)
);

CREATE INDEX idx_reviews_product ON reviews(product_id);

-- ============================================================
-- wishlist
-- ============================================================
CREATE TABLE wishlist (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE(user_id, product_id)
);

-- ============================================================
-- discount_codes
-- ============================================================
CREATE TABLE discount_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed')),
    value DECIMAL(10,2) NOT NULL,
    min_order_value DECIMAL(10,2) DEFAULT 0,
    max_uses INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- ============================================================
-- inventory_log
-- ============================================================
CREATE TABLE inventory_log (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    change INTEGER NOT NULL, -- positive = added, negative = sold
    reason VARCHAR(100), -- sale / restock / adjustment
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_log_product ON inventory_log(product_id);

-- ============================================================
-- trigger: keep updated_at fresh on products / orders / users
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
