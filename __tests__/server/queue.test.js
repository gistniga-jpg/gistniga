// Mock ioredis before any imports
const mockRedis = {
  sismember: jest.fn(),
  rpush: jest.fn(),
  sadd: jest.fn(),
  lrem: jest.fn(),
  srem: jest.fn(),
  llen: jest.fn(),
  disconnect: jest.fn(),
};

// Return the mock when ioredis is required
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

const Queue = require('../../server/queue');

describe('Queue', () => {
  let queue;
  const QUEUE_KEY = "randomchat_waiting_queue";
  const SET_KEY = "randomchat_waiting_set";

  beforeEach(() => {
    jest.clearAllMocks();
    queue = new Queue('redis://mock-url');
  });

  it('should create a Redis client when instantiated', () => {
    expect(require('ioredis')).toHaveBeenCalledWith('redis://mock-url');
  });

  describe('enqueue', () => {
    it('should add user to queue and set if not already present', async () => {
      mockRedis.sismember.mockResolvedValue(0); // 0 means not a member
      await queue.enqueue('user1');
      expect(mockRedis.sismember).toHaveBeenCalledWith(SET_KEY, 'user1');
      expect(mockRedis.rpush).toHaveBeenCalledWith(QUEUE_KEY, 'user1');
      expect(mockRedis.sadd).toHaveBeenCalledWith(SET_KEY, 'user1');
    });

    it('should not add user to queue or set if already present', async () => {
      mockRedis.sismember.mockResolvedValue(1); // 1 means is a member
      await queue.enqueue('user1');
      expect(mockRedis.sismember).toHaveBeenCalledWith(SET_KEY, 'user1');
      expect(mockRedis.rpush).not.toHaveBeenCalled();
      expect(mockRedis.sadd).not.toHaveBeenCalled();
    });
  });

  describe('dequeue', () => {
    it('should remove user from queue and set', async () => {
      await queue.dequeue('user1');
      expect(mockRedis.lrem).toHaveBeenCalledWith(QUEUE_KEY, 0, 'user1');
      expect(mockRedis.srem).toHaveBeenCalledWith(SET_KEY, 'user1');
    });
  });

  describe('getLength', () => {
    it('should get queue size by calling llen', async () => {
      mockRedis.llen.mockResolvedValue(5);
      const size = await queue.getLength();
      expect(mockRedis.llen).toHaveBeenCalledWith(QUEUE_KEY);
      expect(size).toBe(5);
    });
  });

  describe('disconnect', () => {
    it('should disconnect the redis client', async () => {
      await queue.disconnect();
      expect(mockRedis.disconnect).toHaveBeenCalled();
    });
  });
});