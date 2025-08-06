const config = {
    // Screen elements
    startScreen: document.getElementById("start-screen"),
    chatScreen: document.getElementById("chat-screen"),

    // Buttons
    mainButton: document.getElementById("m-mainButton"),
    sendButton: document.getElementById("m-sendButton"),
    leaveButton: document.getElementById("leave-button"),

    // Chat elements
    messageInput: document.getElementById("m-messageInput"),
    messages: document.getElementById("m-messages"),
    partnerStatus: document.querySelector(".partner-status"),

    // Ad elements
    adPopupOverlay: document.getElementById('adPopupOverlay'),
    adCloseBtn: document.getElementById('adCloseBtn'),
    adStorageKey: 'adPopupCountMobile',
    adPopupInterval: 100
};

// --- App Logic ---

// Override the default showChat and showStart functions from common.js
function showChat() {
    config.startScreen.style.display = 'none';
    config.chatScreen.style.display = 'flex';
}

function showStart() {
    config.chatScreen.style.display = 'none';
    config.startScreen.style.display = 'flex';
}

// Instantiate the main chat logic from common.js
const chat = setupGistChat(config, showChat, showStart);

// --- Event Listeners for Mobile --- 

// Use touchstart for faster response on mobile for the send button
config.sendButton.addEventListener("touchstart", (e) => {
  e.preventDefault(); // Prevents ghost clicks
  chat.sendMessage();
});

// Ensure the input is visible when the keyboard appears
config.messageInput.addEventListener('focus', () => {
  setTimeout(() => {
    config.messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300);
});

// Initial state setup is now handled by the HTML (display: none)
// No need to call showStart() initially unless there's a specific reason.
