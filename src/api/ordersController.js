const { ethers } = require('ethers');
const { orderBook } = require('../engine/orderBook');

// EIP-712 Domain and Types for signature verification
const domain = {
    name: "ByteStrike-Orders",
    version: "1",
    chainId: process.env.CHAIN_ID || 1,
    verifyingContract: process.env.ORDER_BOOK_CONTRACT_ADDRESS
};

const types = {
    Order: [
        { name: "maker", type: "address" },
        { name: "marketId", type: "bytes32" },
        { name: "baseSize", type: "uint128" },
        { name: "priceX18", type: "uint128" },
        { name: "expiry", type: "uint64" },
        { name: "nonce", type: "uint64" },
        { name: "leverageBps", type: "uint16" },
        { name: "minFillBps", type: "uint16" },
        { name: "flags", type: "uint8" },
        { name: "isLong", type: "bool" }
    ]
};


const submitOrder = async (req, res) => {
  const { order, signature } = req.body;

  // Step 1: Validate the Order
  // 1a. Signature Verification
  try {
    const signerAddress = ethers.utils.verifyTypedData(domain, types, order, signature);
    if (signerAddress.toLowerCase() !== order.maker.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } catch (error) {
    console.error("Signature verification error:", error);
    return res.status(400).json({ error: 'Signature verification failed' });
  }

  // 1b. Sanity Checks
  if (BigInt(order.baseSize) <= 0) {
    return res.status(400).json({ error: 'Order size must be positive' });
  }
  if (order.expiry !== 0 && Date.now() / 1000 > order.expiry) {
    return res.status(400).json({ error: 'Order has expired' });
  }
  // Add more checks like marketId existence if needed

  // Step 2 & 3: Process the order (Maker vs. Taker)
  const result = orderBook.processOrder(order);

  if (result.success) {
    res.status(201).json(result);
  } else {
    res.status(400).json({ error: result.message });
  }
};

module.exports = {
  submitOrder,
};
