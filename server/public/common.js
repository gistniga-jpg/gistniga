function setupGistChat(config) {
  const { mainButton, messageInput, sendButton, messages, adPopupOverlay, adCloseBtn, adStorageKey, adPopupInterval } = config;
  
  let socket;
  try {
    socket = io();
  } catch (e) {
    console.error('Socket.io client failed to load', e);
    if(mainButton) mainButton.textContent = "Error";
    return;
  }

  let chatting = false, myRoomId = null, isTyping = false;
  let typingTimeout = null;

  // Ad Popup Logic
  function showAdPopup() {
    if (adPopupOverlay) adPopupOverlay.style.display = 'flex';
  }
  function closeAdPopup() {
    if (adPopupOverlay) adPopupOverlay.style.display = 'none';
  }
  if (adCloseBtn) adCloseBtn.onclick = closeAdPopup;

  // Message Display Logic
  function appendMessage(msg, type = 'other') {
    const li = document.createElement("li");
    li.textContent = msg;
    li.className = `${type}-message`;
    messages.appendChild(li);
    messages.scrollTop = messages.scrollHeight;
  }

  // Typing Indicator Logic
  function showTyping(show) {
    const existing = document.querySelector(".typing-message");
    if (show && !existing) {
      appendMessage("Partner is typing...", "typing");
    } else if (!show && existing) {
      existing.remove();
    }
  }

  // UI State Logic
  function setChattingState(isChatting) {
    chatting = isChatting;
    mainButton.textContent = isChatting ? "End Gist" : "Start Gist";
    mainButton.classList.toggle("end", isChatting);
    mainButton.disabled = false;
    messageInput.disabled = !isChatting;
    sendButton.disabled = !isChatting;
    if (!isChatting) {
        messageInput.value = "";
        showTyping(false);
    }
  }

  function finishChat() {
    setChattingState(false);
    let count = Number(localStorage.getItem(adStorageKey) || 0) + 1;
    if (count >= adPopupInterval) {
      showAdPopup();
      count = 0;
    }
    localStorage.setItem(adStorageKey, count);
  }

  // Event Handlers
  mainButton.onclick = function() {
    if (!chatting) {
      mainButton.disabled = true;
      messages.innerHTML = ''; // Clear previous messages
      appendMessage("🔍 Finding a partner...", "system");
      socket.emit("find partner");
    } else {
      if (myRoomId) socket.emit("leave room", myRoomId);
      finishChat();
      appendMessage("👋 You have left the chat.", "system"); // 순서 변경: UI를 초기화한 후 메시지를 표시
    }
  };

  function sendMessage() {
      const msg = messageInput.value.trim();
      if (msg && chatting && myRoomId) {
        appendMessage(msg, 'self');
        socket.emit("chat message", myRoomId, msg);
        messageInput.value = "";
        messageInput.focus();
        if (isTyping) {
          isTyping = false;
          socket.emit('stop typing', myRoomId);
          clearTimeout(typingTimeout);
        }
      }
  }

  sendButton.addEventListener('mousedown', function(e) {
    e.preventDefault(); // 중요: 버튼이 포커스를 훔쳐가지 못하게 막습니다.
    sendMessage();
  });

  messageInput.onkeydown = function(e) {
    if (e.key === "Enter" && !sendButton.disabled) {
        e.preventDefault();
        sendMessage();
    }
  };

  messageInput.oninput = () => {
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
  };

  // Socket Listeners
  socket.on('typing', () => showTyping(true));
  socket.on('stop typing', () => showTyping(false));

  socket.on("partner found", function(roomId) {
    myRoomId = roomId;
    messages.innerHTML = "";
    appendMessage("✅ Connected!", 'system');
    setChattingState(true);
    messageInput.focus();
  });

  socket.on("partner left", function() {
    appendMessage("🚶 Partner has left.", "system");
    finishChat();
  });

  socket.on("chat message", function(msg) {
    showTyping(false);
    appendMessage(msg, 'other');
  });

  // Global Error Handling
  window.onerror = (message, source, lineno, colno) => socket.emit("client error", { message, source, lineno, colno });
  window.addEventListener("unhandledrejection", (event) => socket.emit("client error", { message: event.reason?.message || "Promise rejection" }));
}