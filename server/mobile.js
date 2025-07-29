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

  // === 처음 입장 시 자동 매칭 시도 ===
  mainButton.disabled = true;
  appendMessage("🔍 Finding your anonymous gist buddy…");
  socket.emit("find partner");
});

// === 전역 변수 ===
const mainButton = document.getElementById("m-mainButton");
const messageInput = document.getElementById("m-messageInput");
const sendButton = document.getElementById("m-sendButton");
const messages = document.getElementById("m-messages");
const socket = io();

let chatting = false;
let myRoomId = null;
let isTyping = false;
let typingTimeout = null;



// === 메시지 표시 ===
function appendMessage(msg, self) {
  const li = document.createElement("li");
  li.textContent = msg;
  li.className = self ? "self-message" : "other-message";
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
}

// === 입력중 안내 메시지(메시지 목록에 한 줄) ===
function showTypingInChat() {
  if (document.getElementById("typing-message-li")) return;
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

// === 입력창 이벤트: 입력중이면 typing, 멈추면 stop typing ===
messageInput.addEventListener('input', () => {
  if (!chatting || !myRoomId) return;
  socket.emit('typing', myRoomId);
  if (messageInput.value.trim()) {
    // 입력중: stop typing 보낼 필요 없음
    clearTimeout(typingTimeout);
  } else {
    // 입력이 완전히 지워졌을 때만 stop typing
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit('stop typing', myRoomId);
    }, 500); // 0.5초 정도로도 충분
  }
});

// === 소켓 이벤트로 입력중 안내 표시/삭제 ===
socket.on('typing', () => {
  showTypingInChat();
});
socket.on('stop typing', () => {
  removeTypingInChat();
});

// === UI 리셋 ===
function resetUI() {
  mainButton.textContent = "Start Gist";
  mainButton.classList.remove("end");
  mainButton.disabled = false;
  messageInput.value = "";
  messageInput.placeholder = "Type a message...";
  messageInput.disabled = true;
  sendButton.disabled = true;
  chatting = false;
  myRoomId = null;
  isTyping = false;
  removeTypingInChat();
}

// === 채팅 종료 + 광고 카운트 ===
function finishChat() {
  resetUI();
  let count = Number(localStorage.getItem('adPopupCountMobile') || 0) + 1;
  const AD_POPUP_INTERVAL = 2; // 원하는 값으로 수정
  if (count >= AD_POPUP_INTERVAL) {
    showAdPopup();
    count = 0;
  }
  localStorage.setItem('adPopupCountMobile', count);
}

// === 메인 버튼(매칭/종료) ===
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

// === 메시지 전송 ===
// === 메시지 전송 ===
sendButton.addEventListener("mousedown", (e) => {
  // iOS에서 키보드 유지: 버튼 클릭으로 blur 방지
  e.preventDefault();
  messageInput.focus(); // 미리 포커스 유지
});

sendButton.onclick = function(e) {
  e.preventDefault(); // 기본 제출 방지

  const msg = messageInput.value.trim();
  if (msg && chatting && myRoomId) {
    appendMessage(msg, true);
    socket.emit("chat message", myRoomId, msg);
    messageInput.value = "";

    // 메시지 전송 후에도 키보드 유지
    messageInput.focus();

    if (isTyping) {
      isTyping = false;
      socket.emit('stop typing', myRoomId);
    }

    // 스크롤을 맨 아래로
    messages.scrollTop = messages.scrollHeight;
  }
};
messageInput.onkeydown = function(e) {
  if (e.key === "Enter" && !sendButton.disabled) sendButton.onclick();
};

// === 매칭/방 입장 ===
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

// === 상대방 나감 ===
socket.on("partner left", function() {
  appendMessage("🚶 Your anon buddy don waka. Try another?", false);
  removeTypingInChat();
  isTyping = false;
  finishChat();
});

// === 채팅 메시지 수신 ===
socket.on("chat message", function(msg) {
  appendMessage(msg, false);
  removeTypingInChat();
});

// === 매칭 실패 ===
socket.on("no partner", function() {
  appendMessage("❗ No partner found. Try again!");
  removeTypingInChat();
  resetUI();
});
