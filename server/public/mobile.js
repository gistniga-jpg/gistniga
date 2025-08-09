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
    setupGistChat(config);
});

function setupGistChat(config) {
    const { mainButton, messageInput, sendButton, messages, adPopupOverlay, adCloseBtn, adStorageKey, adPopupInterval } = config;
    let socket;
    let partnerId;
    let isSearching = false;
    let adPopupCount = parseInt(localStorage.getItem(adStorageKey)) || 0;

    function showAdPopup() {
        if (adPopupOverlay) {
            adPopupOverlay.style.display = 'flex';
        }
    }

    function closeAdPopup() {
        if (adPopupOverlay) {
            adPopupOverlay.style.display = 'none';
        }
    }

    function handleAdDisplay() {
        adPopupCount++;
        localStorage.setItem(adStorageKey, adPopupCount);
        if (adPopupCount % adPopupInterval === 0) {
            showAdPopup();
        }
    }

    if (adCloseBtn) {
        adCloseBtn.addEventListener('click', closeAdPopup);
    }

    function addMessage(message, type) {
        const li = document.createElement('li');
        li.textContent = message;
        li.className = type;
        messages.appendChild(li);
        messages.scrollTop = messages.scrollHeight;
    }

    function connectToServer() {
        socket = io({ query: { device: 'mobile' } });

        socket.on('connect', () => {
            addMessage('Connected to server.', 'system');
        });

        socket.on('searching', () => {
            addMessage('Searching for a partner...', 'system');
            isSearching = true;
            mainButton.textContent = 'Stop Search';
            mainButton.classList.remove('start');
            mainButton.classList.add('stop');
        });

        socket.on('match', (data) => {
            partnerId = data.partnerId;
            addMessage('Partner found!', 'system');
            isSearching = false;
            mainButton.textContent = 'End Gist';
            mainButton.classList.remove('stop');
            mainButton.classList.add('end');
            messageInput.disabled = false;
            sendButton.disabled = false;
            setTimeout(() => messageInput.focus(), 0); // Focus on match
        });

        socket.on('chat message', (msg) => {
            addMessage('Partner: ' + msg, 'partner');
        });

        socket.on('partner disconnected', () => {
            addMessage('Partner has disconnected.', 'system');
            resetChat();
        });

        socket.on('disconnect', () => {
            addMessage('Disconnected from server.', 'system');
            resetChat();
        });
    }

    function resetChat() {
        if (socket) {
            socket.disconnect();
        }
        partnerId = null;
        isSearching = false;
        mainButton.textContent = 'Start Gist';
        mainButton.classList.remove('stop', 'end');
        mainButton.classList.add('start');
        messageInput.disabled = true;
        sendButton.disabled = true;
        messageInput.value = '';
        messages.innerHTML = '';
        handleAdDisplay();
    }

    mainButton.addEventListener('click', () => {
        if (!socket || !socket.connected) {
            connectToServer();
        } else if (isSearching) {
            socket.disconnect();
        } else if (partnerId) {
            socket.disconnect();
        }
    });

    const sendMessage = () => {
        const message = messageInput.value.trim();
        if (message && partnerId) {
            socket.emit('chat message', { to: partnerId, message: message });
            addMessage('You: ' + message, 'user');
            messageInput.value = '';
        }
        // Refocus the input to keep the keyboard open
        setTimeout(() => messageInput.focus(), 0);
    };

    sendButton.addEventListener('click', sendMessage);

    messageInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendMessage();
        }
    });
}