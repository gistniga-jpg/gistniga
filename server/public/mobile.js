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
    const setScreenHeight = () => {
        if (!window.visualViewport) return;
        
        const vh = window.visualViewport.height;
        // Apply the height to the active screen's container
        const activeScreen = document.querySelector('.screen[style*="display: flex"]');
        if(activeScreen) {
            activeScreen.style.height = `${vh}px`;
        }
    };

    if (window.visualViewport) {
        setScreenHeight();
        window.visualViewport.addEventListener('resize', setScreenHeight);
    } else {
        // Fallback for older browsers
        const screens = document.querySelectorAll('.screen');
        screens.forEach(s => s.style.height = '100dvh');
    }
});