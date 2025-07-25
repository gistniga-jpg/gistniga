// === 광고 팝업 ===
function showAdPopup() {
  document.getElementById('adPopupOverlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function closeAdPopup() {
  document.getElementById('adPopupOverlay').style.display = 'none';
  document.body.style.overflow = '';
}
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('adCloseBtn').onclick = closeAdPopup;

  document.body.style.overflow = "hidden"; // CHANGED: 화면 고정

  // ↓↓↓ 배경 클릭시 닫기 기능 제거(주석처리)
  // document.getElementById('adPopupOverlay').onclick = function(e) {
  //   if (e.target === this) closeAdPopup();
  // };

  // === [CHANGED] 처음 입장 시 자동 매칭 + 안내문구 출력 ===
  mainButton.disabled = true;
  appendMessage("🔍 Finding your anonymous gist buddy…");
  socket.emit("find partner");
});

// === 채팅 ===
const mainButton = document.getElementById("mainButton");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const messages = document.getElementById("messages");
const socket = io();

let chatting = false, myRoomId = null;

// === 메시지 표시 ===
function appendMessage(msg, self) {
  const li = document.createElement("li");
  li.textContent = msg;
  li.className = self ? "self-message" : "other-message";
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
}

// === 입력중 안내를 메시지 목록에 표시/삭제 ===
function showTypingInChat() {
  if (document.getElementById("typing-message-li")) return; // 중복 방지
  const li = document.createElement("li");
  li.id = "typing-message-li";
  li.className = "typing-message";
  li.innerHTML = `<span class="typing-label">Partner is typing</span>
    <span class="typing-dots"><span></span><span></span><span></span></span>`;
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
}
function removeTypingInChat() {
  const li = document.getElementById("typing-message-li");
  if (li) li.remove();
}

// === 입력창 이벤트: 입력 중이면 typing 신호, 비면 stop typing 신호 ===
let isTyping = false;
messageInput.addEventListener('input', () => {
  if (!chatting || !myRoomId) return;
  if (!isTyping) {
    isTyping = true;
    socket.emit('typing', myRoomId);
  }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    isTyping = false;
    socket.emit('stop typing', myRoomId);
  }, 1500);
});

// === 소켓 이벤트로 입력중 안내를 채팅창에 표시/삭제 ===
socket.on('typing', () => {
  showTypingInChat();
});
socket.on('stop typing', () => {
  removeTypingInChat();
});

// === 메시지 도착/채팅 종료/상대방 나감/리셋시 타이핑 안내도 제거 ===
function resetUI() {
  mainButton.textContent = "Start Gist";
  mainButton.classList.remove("end");
  mainButton.disabled = false;
  messageInput.value = "";
  messageInput.placeholder = "Type a message...";
  messageInput.disabled = true;
  sendButton.disabled = true;
  chatting = false; myRoomId = null;
  removeTypingInChat();
}
function finishChat() {
  resetUI();
  let count = Number(localStorage.getItem('adPopupCount') || 0) + 1;
  const AD_POPUP_INTERVAL = 100; // ← 여기에 원하는 횟수 설정!
  if (count >= AD_POPUP_INTERVAL) {
    showAdPopup();
    count = 0;
  }
  localStorage.setItem('adPopupCount', count);
}

// === 메인/전송 버튼 및 소켓 이벤트 처리 ===
mainButton.onclick = function() {
  if (!chatting) {
    mainButton.disabled = true;
    appendMessage("🔍 Finding your anonymous gist buddy…");
    socket.emit("find partner");
  } else {
    if (myRoomId) socket.emit("leave room", myRoomId);
    finishChat();
  }
};

sendButton.onclick = function() {
  const msg = messageInput.value.trim();
  if (msg && chatting && myRoomId) {
    appendMessage(msg, true);
    socket.emit("chat message", myRoomId, msg); // roomId 추가!
    messageInput.value = "";
    if (isTyping) {
      isTyping = false;
      socket.emit('stop typing', myRoomId);
    }
  }
};

messageInput.onkeydown = function(e) {
  if (e.key === "Enter" && !sendButton.disabled) sendButton.onclick();
};

socket.on("partner found", function(roomId) {
  myRoomId = roomId;
  chatting = true;
  mainButton.textContent = "End Gist";
  mainButton.classList.add("end");
  mainButton.disabled = false;
  messageInput.disabled = false;
  sendButton.disabled = false;
  messages.innerHTML = "";
  messageInput.value = "";
  messageInput.placeholder = "Type a message...";
  appendMessage("✅ Connected! Gist with your anon buddy!", false);
  removeTypingInChat();
});

socket.on("partner left", function() {
  appendMessage("🚶 Your anon buddy don waka. Try another?", false);
  removeTypingInChat();
  isTyping = false;
  resetUI();
});

socket.on("chat message", function(msg) {
  appendMessage(msg, false);
  removeTypingInChat();
});

socket.on("no partner", function() {
  removeTypingInChat();
  resetUI();
});
