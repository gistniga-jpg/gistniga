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
    setupGistChat(config, showChat, showStart);

    // --- ULTIMATE LAYOUT FIX: JS-controlled Height ---
    // This function ensures the active screen always perfectly fits the visible viewport.
    const setScreenHeight = () => {
        if (!window.visualViewport) return;
        
        const vh = window.visualViewport.height;
        // Apply the height to both screens. The inactive one is display:none anyway.
        if (config.startScreen) {
            config.startScreen.style.height = `${vh}px`;
        }
        if (config.chatScreen) {
            config.chatScreen.style.height = `${vh}px`;
        }
    };

    if (window.visualViewport) {
        // Set initial height on load
        setScreenHeight();
        // Update height whenever the viewport changes (keyboard, address bar etc.)
        window.visualViewport.addEventListener('resize', setScreenHeight);
    } else {
        // Basic fallback for older browsers that don't support visualViewport
        if(config.startScreen) config.startScreen.style.height = '100dvh';
    }
});