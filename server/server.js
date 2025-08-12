const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const compression = require("compression");
const Queue = require(__dirname + "/queue.js");
const Matchmaker = require(__dirname + "/matchmaker.js");

const app = express();
app.use(compression());

// CHANGED: 아주 가벼운 접근 로그(PII 없음)
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

app.get('/', (req, res) => {
  const ua = req.headers['user-agent'] || '';
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone|IEMobile|BlackBerry/i.test(ua);
  if (isMobile) {
    res.redirect('/mobile.html');
  } else {
    res.redirect('/chat.html');
  }
});

// ===== 정적 파일 서빙 =====
// 기존에는 public 폴더만 노출했는데, 실제 html/css/js는 프로젝트 루트에 있어 404 가능성 높음
app.use('/AD', express.static(path.join(__dirname, 'AD'), { maxAge: '1d', etag: false })); // 기존 유지
app.use('/server/public', express.static(path.join(__dirname, 'icon'), { maxAge: '1d', etag: false })); // 기존 유지
app.use(express.static(path.join(__dirname), { maxAge: '1d', etag: false })); // CHANGED: 프로젝트 루트 노출
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d', etag: false })); // CHANGED: 혹시 있을지 모를 public도 함께 노출(호환성)

// CHANGED: 정적 서빙 실패 환경 대비, 명시 라우트도 추가
app.get('/chat.html', (req, res) => res.sendFile(path.join(__dirname, 'chat.html')));
app.get('/mobile.html', (req, res) => res.sendFile(path.join(__dirname, 'mobile.html')));

// CHANGED: 헬스/메트릭
app.get('/health', (req, res) => res.status(200).json({ ok: true }));
// 간단 메트릭 (대기열/온라인/누적)
let totalConnections = 0;
let totalBytes = 0;
app.get('/metrics-basic', async (req, res) => {
  try {
    const waiting = await queue.getLength();
    res.json({
      online: io.engine.clientsCount,
      waiting,
      totalConnections,
      totalBytes
    });
  } catch (e) {
    res.status(500).json({ error: 'metrics error' });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, // 운영시 도메인 화이트리스트 권장
  pingInterval: 25000,
  pingTimeout: 1200000,
  serveClient: true
});

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const queue = new Queue(REDIS_URL);
const matchmaker = new Matchmaker(queue);

const ROOMS_KEY = "randomchat_rooms";

// Monitoring log (기존 유지)
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
// CHANGED: AWS, 도커 등에서 외부 접근 위해 0.0.0.0 바인딩
server.listen(PORT, "0.0.0.0", () => {
  console.log("서버 시작:", PORT);
  matchmaker.start();
});

// CHANGED: SIGTERM도 함께 처리 (AWS ECS/EB 종료 시 흔함)
async function gracefulShutdown(signal) {
  console.log(`서버 종료 중... (${signal})`);
  try {
    matchmaker.stop();
    await queue.disconnect();
  } catch (e) {
    console.error("graceful shutdown error:", e);
  } finally {
    server.close(() => {
      console.log("서버 종료.");
      process.exit(0);
    });
    // 안전망 타임아웃
    setTimeout(() => process.exit(0), 5000).unref();
  }
}
process.on("SIGINT", () => gracefulShutdown("SIGINT"));   // Ctrl+C
process.on("SIGTERM", () => gracefulShutdown("SIGTERM")); // 플랫폼 종료
