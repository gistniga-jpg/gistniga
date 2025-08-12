const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const compression = require("compression");
const Queue = require(__dirname + "/queue.js");
const Matchmaker = require(__dirname + "/matchmaker.js");

const app = express();
app.use(compression());

app.get('/', (req, res) => {
  const ua = req.headers['user-agent'] || '';
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone|IEMobile|BlackBerry/i.test(ua);
  if (isMobile) {
    res.redirect('/mobile.html');
  } else {
    res.redirect('/chat.html');
  }
});

// CHANGED: 정적 경로에 없더라도 두 페이지는 반드시 서빙되도록 명시 라우트 추가
app.get('/chat.html', (req, res) => { // CHANGED
  res.sendFile(path.join(__dirname, 'chat.html')); // CHANGED
});
app.get('/mobile.html', (req, res) => { // CHANGED
  res.sendFile(path.join(__dirname, 'mobile.html')); // CHANGED
});

// Serve static files with caching headers (원본 유지)
app.use('/AD', express.static(path.join(__dirname, 'AD'), { maxAge: '1d', etag: false }));
app.use('/server/public', express.static(path.join(__dirname, 'icon'), { maxAge: '1d', etag: false }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d', etag: false }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  pingInterval: 25000,
  pingTimeout: 1200000,
  serveClient: true
});

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const queue = new Queue(REDIS_URL);
const matchmaker = new Matchmaker(queue);

const ROOMS_KEY = "randomchat_rooms";

let totalConnections = 0;
let totalBytes = 0;

// Monitoring log (원본 유지)
setInterval(() => {
  console.log(
    `[MONITOR] 현재 접속자: ${io.engine.clientsCount}, 누적 접속자: ${totalConnections}, 누적 전송량: ${totalBytes} bytes`
  );
}, 10000);

async function createRoom(roomId, users) {
  await queue.redis.hset(ROOMS_KEY, roomId, JSON.stringify(users));
}

async function removeRoom(roomId) {
  await queue.redis.hdel(ROOMS_KEY, roomId);
}

matchmaker.on("match", (socketId1, socketId2) => {
  const socket1 = io.sockets.sockets.get(socketId1);
  const socket2 = io.sockets.sockets.get(socketId2);

  if (socket1 && socket2 && socket1.connected && socket2.connected) {
    const roomId = 'room_' + Math.random().toString(36).slice(2, 10);
    createRoom(roomId, [socketId1, socketId2]);
    socket1.join(roomId);
    socket2.join(roomId);
    socket1.roomId = roomId;
    socket2.roomId = roomId;
    socket1.emit('partner found', roomId);
    socket2.emit('partner found', roomId);
    console.log(`[MATCH] ${socketId1} <-> ${socketId2} in ${roomId}`);
  } else {
    if (socket1 && socket1.connected) queue.enqueue(socketId1);
    if (socket2 && socket2.connected) queue.enqueue(socketId2);
    console.log(`[MATCH FAILED] One or both sockets disconnected. Re-queuing connected sockets.`);
  }
});

async function handleLeave(socket) {
  const roomId = socket.roomId;
  if (roomId) {
    socket.leave(roomId);
    socket.roomId = null;
    const users = await queue.redis.hget(ROOMS_KEY, roomId);
    if (users) {
      const otherId = JSON.parse(users).find((id) => id !== socket.id);
      const otherSocket = io.sockets.sockets.get(otherId);
      if (otherSocket) {
        otherSocket.leave(roomId);
        otherSocket.roomId = null;
        otherSocket.emit("partner left");
      }
      await removeRoom(roomId);
    }
  }
}

io.on("connection", (socket) => {
  const ua = socket.handshake.headers['user-agent'] || '';
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone|IEMobile|BlackBerry/i.test(ua);
  console.log(`[CONNECT] ${socket.id} | ${isMobile ? 'MOBILE' : 'PC'} | UA: ${ua}`);
  totalConnections++;

  socket.on("client error", (data) => {
    console.log(`[CLIENT ERROR][${socket.id}]`, data);
  });

  socket.on("client ping", (data) => {
    console.log(`[CLIENT PING][${socket.id}]`, data);
    socket.emit("pong");
  });

  socket.on("chat message", (roomId, msg) => {
    totalBytes += Buffer.byteLength(msg, "utf8");
    socket.to(roomId).emit("chat message", msg);
  });

  socket.on('typing', (roomId) => {
    socket.to(roomId).emit('typing');
  });

  socket.on('stop typing', (roomId) => {
    socket.to(roomId).emit('stop typing');
  });

  socket.on("find partner", async () => {
    try {
      await matchmaker.findPartner(socket.id);
    } catch (e) {
      console.log("find partner error:", e);
      socket.emit('server error', '매칭 실패');
    }
  });

  socket.on("leave room", async (roomId) => {
    console.log("[LEAVE ROOM]", socket.id, roomId);
    await handleLeave(socket);
  });

  socket.on("disconnect", async () => {
    console.log("[DISCONNECT]", socket.id);
    await handleLeave(socket);
    await queue.dequeue(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("서버 시작:", PORT);
  matchmaker.start();
});

process.on("SIGINT", async () => {
  console.log("서버 종료 중...");
  matchmaker.stop();
  await queue.disconnect();
  server.close(() => {
    console.log("서버 종료.");
    process.exit(0);
  });
});
