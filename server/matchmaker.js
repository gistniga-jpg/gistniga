const EventEmitter = require("events");

class Matchmaker extends EventEmitter {
  constructor(queue, io) { // Added io
    super();
    this.queue = queue;
    this.io = io; // Store io instance
    this.interval = null;
  }

  start() {
    this.interval = setInterval(async () => {
      const pair = await this.queue.popPair();
      if (pair.length < 2) {
        return; // Queue is empty or has only one user
      }

      const socketId1 = pair[0];
      const socketId2 = pair[1];

      const socket1 = this.io.sockets.sockets.get(socketId1);
      const socket2 = this.io.sockets.sockets.get(socketId2);

      const isSocket1Valid = socket1 && socket1.connected;
      const isSocket2Valid = socket2 && socket2.connected;

      if (isSocket1Valid && isSocket2Valid) {
        // Both sockets are valid, emit match
        this.emit("match", socketId1, socketId2);
      } else if (isSocket1Valid) {
        // Only socket1 is valid, re-queue it with priority
        console.log(`[GHOST CLEANUP] Discarding ghost socket ${socketId2}, re-queuing ${socketId1}`);
        await this.queue.enqueuePriority(socketId1);
      } else if (isSocket2Valid) {
        // Only socket2 is valid, re-queue it with priority
        console.log(`[GHOST CLEANUP] Discarding ghost socket ${socketId1}, re-queuing ${socketId2}`);
        await this.queue.enqueuePriority(socketId2);
      } else {
        // Both are ghosts, do nothing and they will be discarded
        console.log(`[GHOST CLEANUP] Discarding two ghost sockets: ${socketId1}, ${socketId2}`);
      }
    }, 500); // Increased interval slightly to reduce busy-waiting
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  async findPartner(socketId) {
    await this.queue.enqueue(socketId);
  }
}

module.exports = Matchmaker;