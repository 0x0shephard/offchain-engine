let io;

const init = (server) => {
  io = require('socket.io')(server);

  io.on('connection', (socket) => {
    console.log('A user connected via WebSocket');
    socket.on('disconnect', () => {
      console.log('User disconnected from WebSocket');
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

const broadcast = (event, data) => {
  getIO().emit(event, data);
}

module.exports = {
  init,
  getIO,
  broadcast,
};
