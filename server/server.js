const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Redis = require("ioredis");
const helmet = require("helmet"); // ✅ CHANGED: helmet 불러오기

const app = express();
app.use(helmet()); // ✅ CHANGED: 보안 헤더 설정
app.use(express.static(__dirname));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new Redis(REDIS_URL);

const QUEUE_KEY = "randomchat_waiting_queue";
const ROOMS_KEY = "randomchat_rooms";
const setKey = "randomchat_waiting_set";

// Lua Script: 2명씩만 pop
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
return {first, second}
`;
async function atomicPopPair(queueKey) {
  try {
    const result = await redis.eval(popPairScript, 1, queueKey);
    return result || [];
  } catch (e) {
    console.error("atomicPopPair error:", e);
    return [];
  }
}
function safeLog(...args) {
  try { console.log(...args); } catch (e) {}
}
async function enqueue(socketId) {
  const exists = await redis.sismember(setKey, socketId);
  if (!exists) {
    await redis.rpush(QUEUE_KEY, socketId);
    await redis.sadd(setKey, socketId);
  }
}
async function removeFromQueue(socketId) {
  await redis.lrem(QUEUE_KEY, 0, socketId);
  await redis.srem(setKey, socketId);
}
async function createRoom(roomId, users) {
  await redis.hset(ROOMS_KEY, roomId, JSON.stringify(users));
}
async function removeRoom(roomId) {
  await redis.hdel(ROOMS_KEY, roomId);
}
async function leaveAllRooms(socket) {
  const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
  for (const roomId of rooms) socket.leave(roomId);
}
async function getUserRoom(socketId) {
  const rooms = await redis.hgetall(ROOMS_KEY);
  for (const [roomId, users] of Object.entries(rooms)) {
    if (JSON.parse(users).includes(socketId)) return roomId;
  }
  return null;
}

// === 핵심: 마지막 2명 queue 매칭 강제화 + 유령 제거 ===
setInterval(async () => {
  const ids = await redis.lrange(QUEUE_KEY, 0, -1);
  if (ids.length === 2) {
    // 마지막 2명 남으면 직접 popPair 실행!
    const pair = await atomicPopPair(QUEUE_KEY);
    if (pair.length === 2) {
      const [id1, id2] = pair;
      const socket1 = io.sockets.sockets.get(id1);
      const socket2 = io.sockets.sockets.get(id2);
      if (socket1 && socket2 && socket1.connected && socket2.connected) {
        const roomId = 'room_' + Math.random().toString(36).slice(2, 10);
        await createRoom(roomId, [id1, id2]);
        socket1.join(roomId);
        socket2.join(roomId);
        socket1.emit('partner found', roomId);
        socket2.emit('partner found', roomId);
        safeLog(`[MATCH][last2] ${id1} <-> ${id2} in ${roomId}`);
      } else {
        // 한 쪽이라도 끊기면 둘 다 다시 대기열로
        if (socket1 && socket1.connected) await enqueue(id1);
        if (socket2 && socket2.connected) await enqueue(id2);
      }
    }
  }
  // 모든 대기자에 find partner broadcast, 유령 queue에서 제거
  for (const id of ids) {
    const sock = io.sockets.sockets.get(id);
    if (sock && sock.connected) {
      sock.emit('find partner');
    } else {
      await redis.lrem(QUEUE_KEY, 0, id);
      await redis.srem(setKey, id);
      safeLog(`[STALE SOCKET] queue에서 제거됨: ${id}`);
    }
  }
}, 500);

// === 메인 소켓 로직 ===
io.on("connection", (socket) => {
  safeLog("[CONNECT]", socket.id);

socket.on("chat message", (roomId, msg) => {
  // 본인 빼고 같은 방(roomId)에 broadcast
  socket.to(roomId).emit("chat message", msg);
});

// 상대방에게 입력중 알림
socket.on('typing', (roomId) => {
  socket.to(roomId).emit('typing');
});

socket.on('stop typing', (roomId) => {
  socket.to(roomId).emit('stop typing');
});


  socket.on("find partner", async () => {
    try {
      await removeFromQueue(socket.id);
      await leaveAllRooms(socket);

      const pair = await atomicPopPair(QUEUE_KEY);

      if (pair.length === 2) {
        const [id1, id2] = pair;
        const socket1 = io.sockets.sockets.get(id1);
        const socket2 = io.sockets.sockets.get(id2);

        if (socket1 && socket2 && socket1.connected && socket2.connected) {
          const roomId = 'room_' + Math.random().toString(36).slice(2, 10);
          await createRoom(roomId, [id1, id2]);
          socket1.join(roomId);
          socket2.join(roomId);
          socket1.emit('partner found', roomId);
          socket2.emit('partner found', roomId);
          safeLog(`[MATCH] ${id1} <-> ${id2} in ${roomId}`);
        } else {
          if (socket1 && socket1.connected) await enqueue(id1);
          if (socket2 && socket2.connected) await enqueue(id2);
        }
      } else {
        await enqueue(socket.id);
      }
    } catch (e) {
      safeLog("find partner error:", e);
      socket.emit('server error', '매칭 실패');
    }
  });

  socket.on("leave room", async (roomId) => {
    await removeFromQueue(socket.id);
    await leaveAllRooms(socket);

    const users = await redis.hget(ROOMS_KEY, roomId);
    if (users) {
      const otherId = JSON.parse(users).find((id) => id !== socket.id);
      const otherSocket = io.sockets.sockets.get(otherId);
      if (otherSocket) {
        otherSocket.emit("partner left");
        await removeFromQueue(otherId);
        await leaveAllRooms(otherSocket);
      }
      await removeRoom(roomId);
    }
    safeLog("[LEAVE ROOM]", socket.id, roomId);
  });

  socket.on("disconnect", async () => {
    await removeFromQueue(socket.id);
    await leaveAllRooms(socket);

    const roomId = await getUserRoom(socket.id);
    if (roomId) {
      const users = await redis.hget(ROOMS_KEY, roomId);
      if (users) {
        const otherId = JSON.parse(users).find((id) => id !== socket.id);
        const otherSocket = io.sockets.sockets.get(otherId);
        if (otherSocket) {
          otherSocket.emit("partner left");
          await removeFromQueue(otherId);
          await leaveAllRooms(otherSocket);
        }
        await removeRoom(roomId);
      }
    }
    safeLog("[DISCONNECT]", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("서버 시작:", PORT);
});
