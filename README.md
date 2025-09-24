# Off-Chain Matching Engine

This document provides a complete overview of the off-chain matching engine, its architecture, logic, and the end-to-end user flow from order submission to on-chain settlement.

## Part 1: Architecture - Core Components

The matching engine is a centralized backend service that acts as a high-speed intermediary between users and the blockchain. It provides fast order matching and execution, with final settlement occurring on-chain.

1.  **API Server (Express.js)**:
    -   Exposes an HTTP endpoint (`POST /api/v1/orders`) for users to submit new signed orders.
    -   Responsible for initial validation, including cryptographic signature verification.

2.  **In-Memory Order Book & Matching Logic (The "Engine")**:
    -   The brain of the service. It's an in-memory data structure (`Map`) that holds all live buy (bid) and sell (ask) orders for various markets.
    -   Keeps orders in memory for microsecond-level matching speed.
    -   Responsible for classifying orders as "Maker" or "Taker", finding matches, and processing trades.

3.  **Blockchain Transaction Submitter (The "Operator")**:
    -   A secure component (`blockchainSubmitter.js`) holding a private key to a funded wallet.
    -   Uses `ethers.js` to call the `verifyAndConsume` function on the on-chain `OrderBook` smart contract.
    -   This component pays the gas fees to settle matched trades on the blockchain.

4.  **Database (Supabase - PostgreSQL)**:
    -   Used as the persistent storage layer for historical data.
    -   A `trades` table logs every successfully executed trade for record-keeping and analysis.

5.  **WebSocket Server (socket.io)**:
    -   Provides real-time, bidirectional communication to connected frontend clients.
    -   Instantly pushes updates for order book changes (`orderbook-update`) and new trades (`trade`), allowing for a live user experience.

## Part 2: The Complete User & Trade Workflow

This workflow details every step from the moment a user submits an order to when the trade is confirmed on the blockchain.

### Step 1: User Signs and Submits an Order

1.  **Frontend**: The user decides to place an order (e.g., buy 1 ETH at $3,000). The frontend application constructs an order object according to the `OrderLib.sol` structure.
2.  **Signature**: The user's wallet (e.g., MetaMask) is prompted to sign this order data using the EIP-712 standard. This signature proves the user's intent and ownership.
3.  **API Call**: The frontend sends the `order` object and the resulting `signature` to the `POST /api/v1/orders` endpoint of our engine.

### Step 2: Engine Receives and Validates the Order

1.  **Signature Verification**: This is the first and most critical security check. The engine uses `ethers.utils.verifyTypedData` to recover the signer's address from the order and signature. If the recovered address does not match the `maker` address in the order, it's fraudulent and is rejected immediately.
2.  **Sanity Checks**: The engine performs basic validation:
    -   Is the order size greater than zero?
    -   Has the order's expiry time passed?

### Step 3: Classify the Order (Maker vs. Taker)

The engine determines if the order can be filled immediately (a "Taker" order) or if it must rest on the book (a "Maker" order).

1.  **Find the Order Book**: It retrieves the correct in-memory order book for the order's `marketId`.
2.  **Check for a Cross**:
    -   If the new order is a **BUY** order, it looks at the best **ask** (the sell order with the lowest price). If the new order's price is **greater than or equal to** the best ask's price, a trade is possible. This is a **Taker** order.
    -   If the new order is a **SELL** order, it looks at the best **bid** (the buy order with the highest price). If the new order's price is **less than or equal to** the best bid's price, a trade is possible. This is a **Taker** order.
3.  **No Cross**: If a cross does not exist, the order is a **Maker** order.

### Step 4A: Handle a Maker Order (No Match)

1.  **Add to Book**: The new order is added to the correct side of the in-memory book (bids or asks). The array is kept sorted by price to ensure the "best" price is always at the front.
2.  **Broadcast Update**: The engine sends an `orderbook-update` event via WebSockets to all clients, containing the new state of the bids and asks. This allows UIs to update in real-time.

### Step 4B: Handle a Taker Order (The Matching Algorithm)

The engine "walks the book," filling the incoming Taker order against one or more resting Maker orders.

1.  **Loop Through Matches**: The engine loops through the opposite side of the book (e.g., loops through asks if it's a buy order) as long as the Taker order has size left to fill and the prices cross.
2.  **Get Best Match**: It takes the best resting order (the first one in the sorted array).
3.  **Determine Fill Amount**: It calculates the fill size, which is the smaller of the Taker's remaining size and the Maker's size.
4.  **Submit to Blockchain**: This is the critical on-chain step.
    -   The `blockchainSubmitter` calls the `verifyAndConsume` function on the `OrderBook` smart contract.
    -   It passes the **Maker's order**, the **Maker's signature**, and the **fill size**.
    -   The engine's **Operator Wallet** pays the gas fee for this transaction, acting as the official "Taker" on-chain.
5.  **Handle Transaction Result**:
    -   **On-Chain Success**: The transaction is confirmed.
        -   The engine updates the sizes of the Taker and Maker orders in memory.
        -   If the Maker order is fully filled, it's removed from the book.
        -   The trade details are logged to the `trades` table in Supabase.
        -   A `trade` event is broadcast to all clients via WebSockets.
    -   **On-Chain Failure (Revert)**: The transaction fails (e.g., the Maker no longer has sufficient funds).
        -   The engine invalidates the resting Maker order by removing it from the book. This is crucial for keeping the order book clean and accurate.
        -   The loop continues to the next best order to try and fill the Taker.
6.  **Finish or Become Maker**:
    -   If the Taker order is fully filled, the process is complete.
    -   If the Taker order still has size remaining but there are no more matching orders, the remainder of the Taker order becomes a Maker order and is placed on the book (Step 4A).

This complete workflow ensures that orders are validated, matched efficiently off-chain, and settled securely on-chain, with real-time updates provided to users at every step.
