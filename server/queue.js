const Redis = require("ioredis");
const redis = new Redis(process.env.REDIS_URL);

const QUEUE_KEY = "gistnaija_chat_queue";

async function enqueue(socketId) {
  const inQueue = await redis.lrange(QUEUE_KEY, 0, -1);
  if (!inQueue.includes(socketId)) {
    await redis.rpush(QUEUE_KEY, socketId);
  }
}

async function dequeue() {
  return await redis.lpop(QUEUE_KEY);
}

async function removeFromQueue(socketId) {
  await redis.lrem(QUEUE_KEY, 0, socketId);
}

module.exports = { enqueue, dequeue, removeFromQueue };
