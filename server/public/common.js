
const socket = io();

function setupGistChat(config) {
  const { mainButton, messageInput, sendButton, messages, adPopupOverlay, adCloseBtn, adStorageKey, adPopupInterval } = config;

  let chatting = false, myRoomId = null;
  let typingTimeout = null;
  let isTyping = false;

  // === Ad Popup Logic ===
  function showAdPopup() {
    if (adPopupOverlay) adPopupOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  function closeAdPopup() {
    if (adPopupOverlay) adPopupOverlay.style.display = 'none';
    document.body.style.overflow = '';
  }
  if (adCloseBtn) adCloseBtn.onclick = closeAdPopup;

  // === Message Display Logic ===
  function appendMessage(msg, self) {
    const li = document.createElement("li");
    li.textContent = msg;
    li.className = self ? "self-message" : "other-message";
    messages.appendChild(li);
    messages.scrollTop = messages.scrollHeight;
  }

  // === Typing Indicator Logic ===
  function showTypingInChat() {
    if (document.getElementById("typing-message-li")) return;
    const li = document.createElement("li");
    li.id = "typing-message-li";
    li.className = "typing-message";
    li.innerHTML = `<span class="typing-label">Partner is typing</span><span class="typing-dots"><span></span><span></span><span></span></span>`;
    messages.appendChild(li);
    messages.scrollTop = messages.scrollHeight;
  }
  function removeTypingInChat() {
    const li = document.getElementById("typing-message-li");
    if (li) li.remove();
  }

  // === UI State Logic ===
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
    let count = Number(localStorage.getItem(adStorageKey) || 0) + 1;
    if (count >= adPopupInterval) {
      showAdPopup();
      count = 0;
    }
    localStorage.setItem(adStorageKey, count);
  }

  // === Event Handlers ===
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

  function sendMessage() {
      const msg = messageInput.value.trim();
      if (msg && chatting && myRoomId) {
        appendMessage(msg, true);
        socket.emit("chat message", myRoomId, msg);
        messageInput.value = "";
        if (isTyping) {
          isTyping = false;
          socket.emit('stop typing', myRoomId);
        }
      }
  }

  sendButton.onclick = sendMessage;
  messageInput.onkeydown = function(e) {
    if (e.key === "Enter" && !sendButton.disabled) sendMessage();
  };

  // === Socket Listeners ===
  socket.on('typing', showTypingInChat);
  socket.on('stop typing', removeTypingInChat);

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
    finishChat();
  });

  socket.on("chat message", function(msg) {
    appendMessage(msg, false);
    removeTypingInChat();
  });

  socket.on("no partner", function() {
    removeTypingInChat();
    resetUI();
  });

  // Initial state
  document.addEventListener('DOMContentLoaded', function() {
    mainButton.disabled = true;
    appendMessage("🔍 Finding your anonymous gist buddy…");
    socket.emit("find partner");
  });

  return { sendMessage };
}

// === Global Listeners (outside the main function) ===
window.onerror = function (message, source, lineno, colno, error) {
  socket.emit("client error", { message, source, lineno, colno });
};
window.addEventListener("unhandledrejection", (event) => {
  socket.emit("client error", { message: event.reason?.message || "Promise rejection" });
});

setInterval(() => {
  socket.emit("client ping", { ts: Date.now(), url: location.href });
}, 5000);
