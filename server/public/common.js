function setupGistChat(config, showChat, showStart) {
  const { 
    mainButton, messageInput, sendButton, messages, 
    leaveButton, partnerStatus, adPopupOverlay, adCloseBtn, 
    adStorageKey, adPopupInterval 
  } = config;

  let socket;
  try {
    socket = io();
  } catch (e) {
    console.error('Socket.io client failed to load', e);
    if (partnerStatus) partnerStatus.textContent = "Connection Failed";
    return;
  }

  let chatting = false, myRoomId = null, isTyping = false;
  let typingTimeout = null;

  // === Ad Popup Logic ===
  function showAdPopup() {
    if (adPopupOverlay) adPopupOverlay.style.display = 'flex';
  }
  function closeAdPopup() {
    if (adPopupOverlay) adPopupOverlay.style.display = 'none';
  }
  if (adCloseBtn) adCloseBtn.onclick = closeAdPopup;

  // === Message & UI Logic ===
  function appendMessage(msg, type = 'other') {
    const li = document.createElement("li");
    li.textContent = msg;
    li.className = `${type}-message`; // 'self', 'other', or 'system'
    messages.appendChild(li);
    messages.scrollTop = messages.scrollHeight;
  }

  function showTyping(show) {
    const existing = document.getElementById("typing-indicator");
    if (show && !existing) {
      const li = document.createElement("li");
      li.id = "typing-indicator";
      li.className = "typing-message";
      li.innerHTML = `Partner is typing...`;
      messages.appendChild(li);
      messages.scrollTop = messages.scrollHeight;
    } else if (!show && existing) {
      existing.remove();
    }
  }

  function resetChat() {
    chatting = false;
    myRoomId = null;
    isTyping = false;
    clearTimeout(typingTimeout);
    messages.innerHTML = '';
    messageInput.value = '';
    messageInput.disabled = true;
    sendButton.disabled = true;
    if (partnerStatus) partnerStatus.textContent = "Connecting...";
    showStart(); // Go back to the start screen
  }

  function startChat(roomId) {
    myRoomId = roomId;
    chatting = true;
    messageInput.disabled = false;
    sendButton.disabled = false;
    messages.innerHTML = '';
    appendMessage("✅ You are now connected!", 'system');
    if (partnerStatus) partnerStatus.textContent = "Connected";
    messageInput.focus();
  }

  function endChatSession() {
    if (myRoomId) {
      socket.emit("leave room", myRoomId);
    }
    resetChat();
    
    let count = Number(localStorage.getItem(adStorageKey) || 0) + 1;
    if (count >= adPopupInterval) {
      showAdPopup();
      count = 0;
    }
    localStorage.setItem(adStorageKey, count);
  }

  // === Event Handlers ===
  mainButton.onclick = function() {
    mainButton.disabled = true;
    showChat();
    appendMessage("🔍 Finding a partner...", 'system');
    socket.emit("find partner");
  };

  leaveButton.onclick = endChatSession;

  function sendMessage() {
    const msg = messageInput.value.trim();
    if (msg && chatting && myRoomId) {
      appendMessage(msg, 'self');
      socket.emit("chat message", myRoomId, msg);
      messageInput.value = "";
      messageInput.focus(); // **KEYBOARD FIX: Refocus input after sending**
      
      if (isTyping) {
        isTyping = false;
        socket.emit('stop typing', myRoomId);
        clearTimeout(typingTimeout);
      }
    }
  }

  sendButton.onclick = sendMessage;
  messageInput.onkeydown = (e) => {
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

  // === Socket Listeners ===
  socket.on('typing', () => showTyping(true));
  socket.on('stop typing', () => showTyping(false));
  socket.on("partner found", startChat);
  socket.on("partner left", () => {
    appendMessage("🚶 Partner has left the chat.", 'system');
    showTyping(false);
    endChatSession();
  });
  socket.on("chat message", (msg) => {
    appendMessage(msg, 'other');
    showTyping(false);
  });

  // === Global Error Handling ===
  window.onerror = (message, source, lineno, colno) => {
    socket.emit("client error", { message, source, lineno, colno });
  };
  window.addEventListener("unhandledrejection", (event) => {
    socket.emit("client error", { message: event.reason?.message || "Promise rejection" });
  });
}