const { enqueue, dequeue, removeFromQueue } = require("./queue");

const matchUsers = async (socket, io) => {
  if (!socket.connected) return;

  let tryCount = 0;
  while (tryCount < 5) {
    const otherSocketId = await dequeue();

    if (!otherSocketId) {
      await enqueue(socket.id);
      return;
    }
    if (otherSocketId === socket.id) {
      await removeFromQueue(socket.id);
      tryCount++;
      continue;
    }

    const otherSocket = io.sockets.sockets.get(otherSocketId);
    if (otherSocket && otherSocket.connected) {
      socket.partner = otherSocket;
      otherSocket.partner = socket;
      socket.emit("match", "You are now connected with a partner.");
      otherSocket.emit("match", "You are now connected with a partner.");
      return;
    }
    tryCount++;
  }
  await enqueue(socket.id);
};

module.exports = { matchUsers };
