document.addEventListener('DOMContentLoaded', function() {
    const config = {
        mainButton: document.getElementById("m-mainButton"),
        messageInput: document.getElementById("m-messageInput"),
        sendButton: document.getElementById("m-sendButton"),
        messages: document.getElementById("m-messages"),
        adPopupOverlay: document.getElementById('adPopupOverlay'),
        adCloseBtn: document.getElementById('adCloseBtn'),
        adStorageKey: 'adPopupCountMobile',
        adPopupInterval: 100
    };
    const chat = setupGistChat(config);

    // Mobile specific event handling
    config.sendButton.addEventListener("touchstart", (e) => {
      e.preventDefault(); 
      chat.sendMessage();
    });

    config.messageInput.addEventListener('focus', () => {
      setTimeout(() => {
        config.messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    });
});