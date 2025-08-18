const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const compression = require("compression");
const { v4: uuidv4 } = require("uuid");
const Queue = require(__dirname + "/queue.js");
const Matchmaker = require(__dirname + "/matchmaker.js");
const chatbot = require(__dirname + "/chatbot.js");

// --- Constants ---
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const ROOMS_KEY = "randomchat_rooms";
const BOT_ID = "GistBot";

const app = express();
app.use(compression());

// --- Basic Routing ---
app.get('/', (req, res) => {
  const ua = req.headers['user-agent'] || '';
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone|IEMobile|BlackBerry/i.test(ua);
  if (isMobile) {
    res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
  }
});

app.get('/chat.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});
app.get('/mobile.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

// --- Static Files ---
app.use('/AD', express.static(path.join(__dirname, 'AD'), { maxAge: '1d', etag: false }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d', etag: false }));

// --- Server and Socket.IO Setup ---
const server = http.createServer(app);

if (CORS_ORIGIN === "*") {
    console.warn("[SECURITY WARNING] CORS is configured to allow all origins (*). For production, set the CORS_ORIGIN environment variable.");
}

const io = new Server(server, {
  cors: { origin: CORS_ORIGIN },
  pingInterval: 25000,
  pingTimeout: 60000,
  serveClient: true
});

// --- Application Logic ---
const queue = new Queue(REDIS_URL);
const matchmaker = new Matchmaker(queue, io, BOT_ID);

let totalConnections = 0;
let totalBytes = 0;

// --- Monitoring ---
setInterval(() => {
  console.log(
    `[MONITOR] 현재 접속자: ${io.sockets.sockets.size}, 누적 접속자: ${totalConnections}, 누적 전송량: ${totalBytes} bytes`
  );
}, 10000);

// --- Room Management ---
async function createRoom(roomId, users) {
  try {
    await queue.redis.hset(ROOMS_KEY, roomId, JSON.stringify(users));
  } catch (error) {
    console.error(`[ERROR] Failed to create room ${roomId} in Redis:`, error);
  }
}

async function removeRoom(roomId) {
  try {
    await queue.redis.hdel(ROOMS_KEY, roomId);
  } catch (error) {
    console.error(`[ERROR] Failed to remove room ${roomId} from Redis:`, error);
  }
}

// --- Matchmaking Handler ---
matchmaker.on("match", (socketId1, socketId2) => {
  const socket1 = io.sockets.sockets.get(socketId1);

  if (socketId2 === BOT_ID) {
    if (!socket1) return console.error("[CRITICAL] Bot matched with a non-existent socket.");
    const roomId = `room_${uuidv4()}`;
    (async () => {
      await createRoom(roomId, [socketId1, BOT_ID]);
      socket1.join(roomId);
      socket1.roomId = roomId;
      socket1.emit('partner found', roomId);
      console.log(`[MATCH] ${socketId1} <-> ${BOT_ID} in ${roomId}`);
      setTimeout(async () => {
        const reply = await chatbot.getReply(socketId1, 'hello');
        io.to(roomId).emit('chat message', reply);
        io.to(roomId).emit('stop typing');
      }, 1000);
    })();
    return;
  }

  const socket2 = io.sockets.sockets.get(socketId2);
  if (!socket1 || !socket2) return console.error("[CRITICAL] Matchmaker emitted a match with a non-existent socket.");

  const roomId = `room_${uuidv4()}`;
  (async () => {
      await createRoom(roomId, [socketId1, socketId2]);
      socket1.join(roomId);
      socket2.join(roomId);
      socket1.roomId = roomId;
      socket2.roomId = roomId;
      socket1.emit('partner found', roomId);
      socket2.emit('partner found', roomId);
      console.log(`[MATCH] ${socketId1} <-> ${socketId2} in ${roomId}`);
  })();
});

// --- Socket Event Handlers ---
async function handleLeave(socket) {
  const roomId = socket.roomId;
  if (!roomId) return;
  try {
    socket.leave(roomId);
    socket.roomId = null;
    const usersJson = await queue.redis.hget(ROOMS_KEY, roomId);
    if (usersJson) {
      const users = JSON.parse(usersJson);
      const otherId = users.find((id) => id !== socket.id);
      if (otherId && otherId !== BOT_ID) {
        const otherSocket = io.sockets.sockets.get(otherId);
        if (otherSocket) {
          otherSocket.leave(roomId);
          otherSocket.roomId = null;
          otherSocket.emit("partner left");
        }
      }
      await removeRoom(roomId);
    }
  } catch (error) {
    console.error(`[ERROR] Failed to handle leave for socket ${socket.id} in room ${roomId}:`, error);
  }
}

io.on("connection", (socket) => {
  const ua = socket.handshake.headers['user-agent'] || '';
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone|IEMobile|BlackBerry/i.test(ua);
  console.log(`[CONNECT] ${socket.id} | ${isMobile ? 'MOBILE' : 'PC'} | UA: ${ua}`);
  totalConnections++;

  socket.on("client error", (data) => {
    console.error(`[CLIENT ERROR][${socket.id}]`, data);
  });

  socket.on("chat message", async (roomId, msg) => {
    totalBytes += Buffer.byteLength(msg, "utf8");
    const usersJson = await queue.redis.hget(ROOMS_KEY, roomId);
    if (usersJson) {
      const users = JSON.parse(usersJson);
      const otherId = users.find((id) => id !== socket.id);
      if (otherId === BOT_ID) {
        io.to(roomId).emit('typing');
        const reply = await chatbot.getReply(socket.id, msg);
        setTimeout(() => {
          io.to(roomId).emit('stop typing');
          io.to(roomId).emit("chat message", reply);
        }, 500 + Math.random() * 1000);
        return;
      }
    }
    socket.to(roomId).emit("chat message", msg);
  });

  socket.on('typing', (roomId) => socket.to(roomId).emit('typing'));
  socket.on('stop typing', (roomId) => socket.to(roomId).emit('stop typing'));

  socket.on("find partner", async () => {
    try {
      await matchmaker.findPartner(socket.id);
    } catch (e) {
      console.error(`[ERROR] find partner error for socket ${socket.id}:`, e);
      socket.emit('server error', '매칭에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  });

  socket.on("leave room", async () => {
    await handleLeave(socket);
  });

  socket.on("disconnect", async () => {
    console.log(`[DISCONNECT] socket: ${socket.id}`);
    try {
      await handleLeave(socket);
      await queue.dequeue(socket.id);
    } catch (error) {
      console.error(`[ERROR] Failed during disconnect for socket ${socket.id}:`, error);
    }
  });
});

// --- Server Start ---
server.listen(PORT, () => {
  console.log(`[FINAL-CHECK] 서버가 이 메시지를 출력한다면, 코드는 완전히 새로 적용된 것입니다. 포트: ${PORT}`);
  chatbot.load();
  matchmaker.start();
});

// --- Graceful Shutdown ---
process.on("SIGINT", () => {
  console.log("\n[SYSTEM] 종료 신호 수신. 5초 후 강제 종료됩니다.");

  // Stop accepting new work
  matchmaker.stop();
  server.close((err) => {
    if (err) {
      console.error("[SYSTEM] 서버 종료 중 에러:", err);
      process.exit(1);
    }
    console.log("[SYSTEM] HTTP 서버가 정상적으로 닫혔습니다.");
  });

  // Attempt to disconnect from Redis, but don't wait forever
  queue.disconnect();
  console.log("[SYSTEM] Redis 연결 종료 시도.");

  // Set a timeout to force exit if graceful shutdown takes too long
  setTimeout(() => {
    console.error("[SYSTEM] 정상 종료에 실패하여, 강제로 종료합니다.");
    process.exit(1);
  }, 5000).unref(); // .unref() allows the program to exit if this is the only event left.
});