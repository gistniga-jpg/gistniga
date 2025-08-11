const Redis = require("ioredis");

class Queue {
  constructor(redisUrl) {
    this.redis = new Redis(redisUrl);
    this.queueKey = "randomchat_waiting_queue";
    this.setKey = "randomchat_waiting_set";
  }

  async enqueue(socketId) {
    const exists = await this.redis.sismember(this.setKey, socketId);
    if (!exists) {
      await this.redis.rpush(this.queueKey, socketId);
      await this.redis.sadd(this.setKey, socketId);
    }
  }

  async dequeue(socketId) {
    await this.redis.lrem(this.queueKey, 0, socketId);
    await this.redis.srem(this.setKey, socketId);
  }

  async getLength() {
    return this.redis.llen(this.queueKey);
  }

  async popPair() {
    const popPairScript = `
      local first = redis.call('lpop', KEYS[1])
      if not first then
          return {}
      end
      local second = redis.call('lpop', KEYS[1])
      if not second then
          redis.call('lpush', KEYS[1], first)
          return {}
      end
      redis.call('srem', KEYS[2], first)
      redis.call('srem', KEYS[2], second)
      return {first, second}
    `;
    try {
      const result = await this.redis.eval(popPairScript, 2, this.queueKey, this.setKey);
      return result || [];
    } catch (e) {
      console.error("popPair error:", e);
      return [];
    }
  }

  async getWaitingUsers() {
    return this.redis.lrange(this.queueKey, 0, -1);
  }

  disconnect() {
    this.redis.disconnect();
  }
}

module.exports = Queue;