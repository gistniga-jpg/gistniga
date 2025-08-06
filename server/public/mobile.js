document.addEventListener('DOMContentLoaded', () => {
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

    // --- Screen Transition Logic ---
    function showChat() {
        if (config.startScreen) config.startScreen.style.display = 'none';
        if (config.chatScreen) config.chatScreen.style.display = 'flex';
    }

    function showStart() {
        if (config.chatScreen) config.chatScreen.style.display = 'none';
        if (config.startScreen) config.startScreen.style.display = 'flex';
    }

    // --- Initialize Core Chat Logic ---
    // Pass config and screen transition functions to the core logic
    setupGistChat(config, showChat, showStart);

    // --- LAYOUT FIX: Handle Keyboard/Viewport Resizing ---
    const chatScreen = config.chatScreen;
    if (window.visualViewport && chatScreen) {
        const setChatScreenHeight = () => {
            // Set the chat screen height to the exact visible area
            chatScreen.style.height = `${window.visualViewport.height}px`;
        };
        
        // Set initial height
        setChatScreenHeight();

        // Update height whenever the viewport changes (keyboard appears/disappears)
        window.visualViewport.addEventListener('resize', setChatScreenHeight);
    }
});