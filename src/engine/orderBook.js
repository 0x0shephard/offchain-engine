const { supabase } = require('../db');
const { broadcast } = require('../websockets/socketManager');

// In-memory store for live order books, keyed by marketId
// marketId -> { bids: [Order], asks: [Order] }
const orderBooks = new Map();

/**
 * Logs a successful trade to the database.
 * @param {object} trade - The trade details.
 */
async function logTrade(trade) {
  const { data, error } = await supabase.from('trades').insert([trade]);
  if (error) {
    console.error('Error logging trade to Supabase:', error);
  } else {
    console.log('Logged trade:', data);
  }
}

/**
 * The core matching engine logic.
 */
const orderBook = {
  /**
   * Processes a new incoming order, classifying it as Maker or Taker.
   * @param {object} order - The signed order.
   * @returns {object} - Success status and message.
   */
  processOrder(order) {
    // Ensure an order book exists for this market
    if (!orderBooks.has(order.marketId)) {
      orderBooks.set(order.marketId, { bids: [], asks: [] });
    }
    const book = orderBooks.get(order.marketId);

    // Step 2: Classify the Order (Maker vs. Taker)
    let isTaker = false;
    if (order.isLong) { // New BUY order
      const bestAsk = book.asks.length > 0 ? book.asks[0] : null;
      if (bestAsk && BigInt(order.priceX18) >= BigInt(bestAsk.priceX18)) {
        isTaker = true;
      }
    } else { // New SELL order
      const bestBid = book.bids.length > 0 ? book.bids[0] : null;
      if (bestBid && BigInt(order.priceX18) <= BigInt(bestBid.priceX18)) {
        isTaker = true;
      }
    }

    if (isTaker) {
      return this.handleTakerOrder(order, book);
    } else {
      return this.handleMakerOrder(order, book);
    }
  },

  /**
   * Handles a Maker order (no immediate match).
   * @param {object} order - The maker order.
   * @param {object} book - The order book for the market.
   */
  handleMakerOrder(order, book) {
    // Step 3A: Add to Book
    const side = order.isLong ? book.bids : book.asks;
    side.push(order);

    // Maintain sort order
    if (order.isLong) { // Bids sorted descending (highest price first)
      side.sort((a, b) => Number(BigInt(b.priceX18) - BigInt(a.priceX18)));
    } else { // Asks sorted ascending (lowest price first)
      side.sort((a, b) => Number(BigInt(a.priceX18) - BigInt(b.priceX18)));
    }

    // Broadcast the new state of the order book
    broadcast('orderbook-update', {
      marketId: order.marketId,
      bids: book.bids,
      asks: book.asks,
    });

    console.log(`Maker order added to book ${order.marketId}`);
    return { success: true, message: 'Order placed on book.' };
  },

  /**
   * Handles a Taker order by walking the book and finding matches.
   * @param {object} takerOrder - The incoming taker order.
   * @param {object} book - The order book for the market.
   */
  handleTakerOrder(takerOrder, book) {
    console.log(`Handling Taker order for ${takerOrder.baseSize} @ ${takerOrder.priceX18}`);
    const trades = [];
    let remainingSize = BigInt(takerOrder.baseSize);

    const bookSide = takerOrder.isLong ? book.asks : book.bids;

    // Loop through the book as long as there's size to fill and matches exist
    while (remainingSize > 0 && bookSide.length > 0) {
      const makerOrder = bookSide[0]; // Best match

      // Check for price cross
      const priceCrosses = takerOrder.isLong
        ? BigInt(takerOrder.priceX18) >= BigInt(makerOrder.priceX18)
        : BigInt(takerOrder.priceX18) <= BigInt(makerOrder.priceX18);

      if (!priceCrosses) {
        break; // No more matches
      }

      // Step 3B: Determine Fill Amount
      const makerSize = BigInt(makerOrder.baseSize);
      const fillSize = remainingSize < makerSize ? remainingSize : makerSize;

      console.log(`Match found! Filling ${fillSize} of Taker order with Maker order.`);

      // Here we would submit to the blockchain. For now, we assume success.
      // const { success, error } = await blockchainSubmitter.matchOrders(takerOrder, makerOrder);
      const blockchainSuccess = true; // ** SIMULATION **

      if (blockchainSuccess) {
        // Update sizes
        remainingSize -= fillSize;
        makerOrder.baseSize = (makerSize - fillSize).toString();

        const trade = {
          marketId: takerOrder.marketId,
          price: makerOrder.priceX18, // Trade executes at the maker's price
          size: fillSize.toString(),
          taker: takerOrder.maker,
          maker: makerOrder.maker,
          timestamp: new Date().toISOString(),
        };
        trades.push(trade);
        logTrade(trade); // Log to historical DB

        // If maker order is filled, remove it
        if (makerOrder.baseSize === '0') {
          bookSide.shift(); // Remove from the front of the array
        }

        // Broadcast the trade confirmation
        broadcast('trade', trade);
      } else {
        // On-chain failure means the maker order is invalid
        console.log(`On-chain match failed. Invalidating maker order.`);
        bookSide.shift(); // Remove the invalid maker order
        // The loop continues to the next best order
      }
    }

    // If the taker order still has size, it becomes a maker order
    if (remainingSize > 0) {
      takerOrder.baseSize = remainingSize.toString();
      this.handleMakerOrder(takerOrder, book);
    }

    // Broadcast the final state of the order book after the matching session
    broadcast('orderbook-update', {
      marketId: takerOrder.marketId,
      bids: book.bids,
      asks: book.asks,
    });

    return { success: true, message: 'Trade executed.', trades };
  },
};

module.exports = {
  orderBook,
};
