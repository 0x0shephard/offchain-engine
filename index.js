const express = require('express');
const http = require('http');
const socketManager = require('./src/websockets/socketManager');
const ordersRouter = require('./src/api/orders');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
socketManager.init(server);

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api/v1', ordersRouter);

app.get('/', (req, res) => {
  res.send('<h1>Off-Chain Matching Engine</h1>');
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

