const { ethers } = require('ethers');
require('dotenv').config();

// ABIs - It's better to have these in a separate file in a real project
const ORDER_BOOK_ABI = [
    "function verifyAndConsume(tuple(address maker, bytes32 marketId, uint128 baseSize, uint128 priceX18, uint64 expiry, uint64 nonce, uint16 leverageBps, uint16 minFillBps, uint8 flags, bool isLong) calldata o, bytes calldata sig, uint128 fillBase) external returns (uint128 remainingBase)",
    "event OrderFilled(bytes32 indexed orderHash, address indexed maker, address indexed taker, bytes32 marketId, uint128 fillBase, uint128 totalFilledBase, bool fullyFilled)"
];

const OPERATOR_PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL;
const ORDER_BOOK_CONTRACT_ADDRESS = process.env.ORDER_BOOK_CONTRACT_ADDRESS;

if (!OPERATOR_PRIVATE_KEY || !RPC_URL || !ORDER_BOOK_CONTRACT_ADDRESS) {
    throw new Error("OPERATOR_PRIVATE_KEY, RPC_URL, and ORDER_BOOK_CONTRACT_ADDRESS must be set in .env");
}

// 1. Setup Provider and Wallet
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const operatorWallet = new ethers.Wallet(OPERATOR_PRIVATE_KEY, provider);

// 2. Setup Contract Instance
const orderBookContract = new ethers.Contract(ORDER_BOOK_CONTRACT_ADDRESS, ORDER_BOOK_ABI, operatorWallet);

console.log(`Blockchain Submitter initialized.`);
console.log(`Operator Address: ${operatorWallet.address}`);
console.log(`OrderBook Contract: ${orderBookContract.address}`);


/**
 * Submits a matched trade to the blockchain.
 * The engine's operator wallet acts as the Taker.
 * @param {object} makerOrder - The resting maker order from the book.
 * @param {string} makerSignature - The signature for the maker order.
 * @param {string} fillSize - The amount of the order to fill (as a string).
 * @returns {Promise<{success: boolean, txHash: string|null, error: string|null}>}
 */
const submitMatch = async (makerOrder, makerSignature, fillSize) => {
    try {
        console.log(`Submitting match to blockchain...`);
        console.log(`  Maker: ${makerOrder.maker}`);
        console.log(`  Fill Size: ${fillSize}`);

        // The contract's `verifyAndConsume` function expects the fill size as a uint128.
        // We pass the maker's order and signature for on-chain verification.
        // The `operatorWallet` is the msg.sender, and thus the Taker.
        const tx = await orderBookContract.verifyAndConsume(
            makerOrder,
            makerSignature,
            fillSize,
            {
                // You may need to adjust gas settings for your network
                gasLimit: 500000 
            }
        );

        console.log(`Transaction sent! Hash: ${tx.hash}`);
        
        // Wait for the transaction to be mined
        const receipt = await tx.wait();
        
        console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);

        return { success: true, txHash: receipt.transactionHash, error: null };

    } catch (error) {
        console.error("Blockchain submission failed:", error.reason || error.message);
        
        // The 'error' object from ethers is often complex.
        // 'error.reason' usually contains the revert message from the contract.
        return { success: false, txHash: null, error: error.reason || "Transaction failed" };
    }
};

module.exports = {
    submitMatch,
    operatorWallet,
};
