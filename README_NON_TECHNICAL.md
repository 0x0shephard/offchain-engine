# Off-Chain Matching Engine: A Simple Guide



## How It Works: The Journey of an Order

Here’s what happens when you decide to place a trade, explained step-by-step.

### Step 1: You Create and "Sign" Your Order

You decide your position, quantity, and price. For example, "I want to go **long** on 1 `ETH-PERP` contract at a price of $3,000."

Instead of immediately sending this to the blockchain, you "sign" it with your digital wallet. This signature is a cryptographic seal of approval that proves the order came from you and hasn't been tampered with. It’s like signing a check before you hand it over—it authorizes the transaction without spending any money yet.

### Step 2: Your Order is Sent to the Engine

Your signed order is sent to our high-speed matching engine. Because this step doesn't touch the blockchain, it's instant and costs nothing.

### Step 3: The Engine Finds a Match

The engine has two lists of orders for the market:
*   A list of **long orders** (bids).
*   A list of **short orders** (asks).

These lists are sorted by two simple rules, known as **Price-Time Priority**:
1.  **Best Price First:** The highest buy prices and the lowest sell prices get top priority.
2.  **First in, First Out:** If two orders have the same price, the one that arrived first gets matched first.

The engine constantly checks if a long order can be matched with a short order.

### Step 4: The Trade is Executed

When a buyer's price meets a seller's price, the engine executes a trade.

*   If your order is matched immediately, you are a **"Taker"** because you are taking an existing offer off the books.
*   If your order can't be matched right away, it is placed in the order list to wait for a match. In this case, you are a **"Maker"** because you are making a new market for others.

### Step 5: The Trade is Settled on the Blockchain

This is the final and most important step.

Once a trade is matched by the engine, the details are sent to the blockchain for settlement. This is where the traders' **positions are officially updated**.

By bundling all the fast-paced matching activity off-chain and only using the blockchain for the final settlement, we get the best of both worlds.


