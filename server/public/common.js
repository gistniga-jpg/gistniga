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
    mainButton.textContent = isChatting ? 'End Gist' : 'Start Gist';
    mainButton.className = isChatting ? 'leave' : 'start';
    mainButton.disabled = false;
    messageInput.disabled = !isChatting;
    sendButton.disabled = !isChatting;
    if (isChatting) {
      messageInput.placeholder = "Say something nice...";
      messageInput.focus();
    } else {
      messageInput.placeholder = "Type a message...";
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
  function handleMainButtonClick() {
    if (!chatting) {
      mainButton.disabled = true;
      messages.innerHTML = ''; // Clear previous messages
     appendMessage(
      "🔍 Searching for your anonymous partner... The more users, the faster the match! Spread the word about gistniga to your friends 🚀",
      "system"
    );
      socket.emit("find partner");
    } else {
      if (myRoomId) socket.emit("leave room", myRoomId);
      finishChat();
      appendMessage("👋 You left the gist. Hit ‘Start Gist’ to get matched again!🔄", "system");
    }
  }

  function sendMessage() {
      const msg = messageInput.value.trim();
      if (msg && chatting && myRoomId) {
        appendMessage(msg, 'self');
        socket.emit("chat message", myRoomId, msg);
        messageInput.value = "";
        if (isTyping) {
          isTyping = false;
          socket.emit('stop typing', myRoomId);
          clearTimeout(typingTimeout);
        }
      }
      // Refocus the input after a short delay to keep the keyboard open
      setTimeout(() => messageInput.focus(), 0);
  }

  mainButton.addEventListener('click', handleMainButtonClick);
  sendButton.addEventListener('mousedown', function(e) {
    e.preventDefault();
    sendMessage();
  });

  messageInput.addEventListener('keydown', function(e) {
    if (e.key === "Enter" && !sendButton.disabled) {
        e.preventDefault();
        sendMessage();
    }
  });

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

  // Socket Listeners
  socket.on('connect', () => {
    // Automatically start finding a partner once connected
    if (!chatting) {
      handleMainButtonClick();
    }
  });

  socket.on('typing', () => showTyping(true));
  socket.on('stop typing', () => showTyping(false));

  socket.on("partner found", function(roomId) {
    myRoomId = roomId;
    messages.innerHTML = "";
    appendMessage("🔥 Connected! You never know what kind of gist you’ll get… Dare to chat? 🍃", 'system');
    setChattingState(true);
  });

  socket.on("partner left", function() {
    appendMessage("🚶 Partner bailed—don’t worry, the next one might just be your perfect match! 🔄", "system");
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
