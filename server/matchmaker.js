const EventEmitter = require("events");

class Matchmaker extends EventEmitter {
  constructor(queue) {
    super();
    this.queue = queue;
    this.interval = null;
  }

  start() {
    this.interval = setInterval(async () => {
      const pair = await this.queue.popPair();
      if (pair.length === 2) {
        this.emit("match", pair[0], pair[1]);
      }
    }, 200);
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