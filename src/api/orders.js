const express = require('express');
const router = express.Router();
const ordersController = require('./ordersController');

router.post('/orders', ordersController.submitOrder);

module.exports = router;
