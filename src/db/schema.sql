-- schema.sql

-- 1. Orders Table
-- This table stores the active maker orders on the book.
CREATE TABLE IF NOT EXISTS orders (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Core Order Details
    maker_address TEXT NOT NULL,
    market_id TEXT NOT NULL,
    is_long BOOLEAN NOT NULL,
    
    -- Sizing and Pricing (stored as TEXT to handle large numbers)
    price_x18 TEXT NOT NULL,
    base_size TEXT NOT NULL, -- The remaining size of the order
    
    -- Order Metadata
    nonce TEXT NOT NULL,
    expiry BIGINT NOT NULL, -- Unix timestamp
    
    -- EIP-712 Signature
    signature TEXT NOT NULL,

    -- Status
    status TEXT DEFAULT 'open' NOT NULL, -- e.g., 'open', 'filled', 'cancelled'

    -- Constraints
    UNIQUE(maker_address, nonce)
);

-- Create an index for faster order book lookups
CREATE INDEX IF NOT EXISTS idx_orders_market_price ON orders (market_id, is_long, price_x18);

COMMENT ON TABLE orders IS 'Stores active, unfilled maker orders for the off-chain order book.';
COMMENT ON COLUMN orders.base_size IS 'The remaining fillable size of the order.';


-- 2. Trades Table
-- This table logs all successfully matched trades.
CREATE TABLE IF NOT EXISTS trades (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    market_id TEXT NOT NULL,
    price TEXT NOT NULL, -- The execution price
    size TEXT NOT NULL, -- The size of the trade
    
    -- Participants
    maker_address TEXT NOT NULL,
    taker_address TEXT NOT NULL
);

COMMENT ON TABLE trades IS 'A log of all historical trades executed by the matching engine.';


-- Optional: Enable Row-Level Security (good practice)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public read access (for a public order book)
CREATE POLICY "Allow public read access on orders" ON orders
    FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on trades" ON trades
    FOR SELECT
    USING (true);

-- Note: Insert/Update/Delete policies should be more restrictive
-- and are handled by the service role key used by the engine.
