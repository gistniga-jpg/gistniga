document.addEventListener('DOMContentLoaded', function() {
    const config = {
        mainButton: document.getElementById("mainButton"),
        messageInput: document.getElementById("messageInput"),
        sendButton: document.getElementById("sendButton"),
        messages: document.getElementById("messages"),
        adPopupOverlay: document.getElementById('adPopupOverlay'),
        adCloseBtn: document.getElementById('adCloseBtn'),
        adStorageKey: 'adPopupCount',
        adPopupInterval: 100
    };
    setupGistChat(config);
});