const EventEmitter = require("events");

class Matchmaker extends EventEmitter {
  constructor(queue, io, botId) { // Added botId
    super();
    this.queue = queue;
    this.io = io;
    this.botId = botId; // Store botId
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
        this.emit("match", socketId1, socketId2);
      } else if (isSocket1Valid) {
        console.log(`[GHOST CLEANUP] Discarding ghost socket ${socketId2}, re-queuing ${socketId1}`);
        await this.queue.enqueuePriority(socketId1);
      } else if (isSocket2Valid) {
        console.log(`[GHOST CLEANUP] Discarding ghost socket ${socketId1}, re-queuing ${socketId2}`);
        await this.queue.enqueuePriority(socketId2);
      } else {
        console.log(`[GHOST CLEANUP] Discarding two ghost sockets: ${socketId1}, ${socketId2}`);
      }
    }, 500);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  async findPartner(socketId) {
    await this.queue.enqueue(socketId);

    // Set a timer to match with a bot if the user is still waiting
    setTimeout(async () => {
      try {
        const isWaiting = await this.queue.isUserInQueue(socketId);
        if (isWaiting) {
          // User is still in the queue, let's match them with a bot
          console.log(`[BOT MATCH] User ${socketId} has been waiting, matching with bot.`);
          await this.queue.dequeue(socketId); // Remove from queue
          this.emit("match", socketId, this.botId);
        }
      } catch (error) {
        console.error(`[ERROR] Failed during bot match timer for socket ${socketId}:`, error);
      }
    }, 5000); // 5-second wait
  }
}

module.exports = Matchmaker;