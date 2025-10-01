class WebSocketClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.apiKey = localStorage.getItem("websocket_api_key") || "";
    this.initializeElements();
    this.bindEvents();
    this.loadSavedApiKey();
  }

  initializeElements() {
    this.apiKeyInput = document.getElementById("apiKeyInput");
    this.connectBtn = document.getElementById("connectBtn");
    this.disconnectBtn = document.getElementById("disconnectBtn");
    this.status = document.getElementById("status");
    this.chatContainer = document.getElementById("chatContainer");
    this.messageInput = document.getElementById("messageInput");
    this.sendBtn = document.getElementById("sendBtn");
  }

  bindEvents() {
    this.connectBtn.addEventListener("click", () => this.connect());
    this.disconnectBtn.addEventListener("click", () => this.disconnect());
    this.sendBtn.addEventListener("click", () => this.sendMessage());

    this.messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.sendMessage();
      }
    });

    this.apiKeyInput.addEventListener("input", () => {
      this.saveApiKey();
    });
  }

  loadSavedApiKey() {
    if (this.apiKey) {
      this.apiKeyInput.value = this.apiKey;
    }
  }

  saveApiKey() {
    this.apiKey = this.apiKeyInput.value.trim();
    localStorage.setItem("websocket_api_key", this.apiKey);
  }

  connect() {
    const apiKey = this.apiKeyInput.value.trim();

    if (!apiKey) {
      alert("Vänligen ange en API-nyckel");
      return;
    }

    this.saveApiKey();

    // Anpassa denna URL till din WebSocket-server
    const serverUrl = "http://localhost:3000"; // Ändra till din servers URL

    try {
      // Socket.IO med JWT i header
      this.socket = io(serverUrl, {
        auth: {
          token: apiKey,
        },
        // Alternativt med extraHeaders om servern förväntar sig det
        extraHeaders: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      this.setupSocketListeners();
      this.updateStatus("Ansluter...", "connecting");
    } catch (error) {
      this.addMessage("system", `Anslutningsfel: ${error.message}`);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  setupSocketListeners() {
    this.socket.on("connect", () => {
      this.isConnected = true;
      this.updateStatus("Ansluten", "connected");
      this.toggleControls(true);
      this.addMessage("system", "Ansluten till servern!");
    });

    this.socket.on("disconnect", (reason) => {
      this.isConnected = false;
      this.updateStatus("Frånkopplad", "disconnected");
      this.toggleControls(false);
      this.addMessage("system", `Frånkopplad: ${reason}`);
    });

    this.socket.on("connect_error", (error) => {
      this.updateStatus("Anslutningsfel", "disconnected");
      this.addMessage("system", `Anslutningsfel: ${error.message}`);

      if (
        error.message.includes("Authentication") ||
        error.message.includes("Unauthorized")
      ) {
        alert("Ogiltig API-nyckel. Kontrollera din JWT token.");
      }
    });

    // Lyssna på meddelanden från servern
    this.socket.on("message", (data) => {
      this.addMessage("other", data);
    });

    // Alternativt event-namn som servern kan använda
    this.socket.on("chat-message", (data) => {
      this.addMessage("other", data);
    });

    this.socket.on("broadcast", (data) => {
      this.addMessage("other", data);
    });
  }

  sendMessage() {
    const message = this.messageInput.value.trim();

    if (!message || !this.isConnected) {
      return;
    }

    // Skicka meddelande till servern
    this.socket.emit("message", message);

    // Visa meddelandet i chatten som "eget"
    this.addMessage("own", message);

    // Rensa input-fältet
    this.messageInput.value = "";
  }

  addMessage(type, content) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}`;

    const timestamp = new Date().toLocaleTimeString("sv-SE");

    if (type === "system") {
      messageDiv.innerHTML = `
        <div><strong>System:</strong> ${content}</div>
        <div class="timestamp">${timestamp}</div>
      `;
      messageDiv.style.background = "#fff3cd";
      messageDiv.style.color = "#856404";
      messageDiv.style.margin = "0 auto";
      messageDiv.style.textAlign = "center";
    } else {
      messageDiv.innerHTML = `
        <div>${content}</div>
        <div class="timestamp">${timestamp}</div>
      `;
    }

    this.chatContainer.appendChild(messageDiv);
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  updateStatus(text, statusClass) {
    this.status.textContent = text;
    this.status.className = `status ${statusClass}`;
  }

  toggleControls(connected) {
    if (connected) {
      this.connectBtn.classList.add("hidden");
      this.disconnectBtn.classList.remove("hidden");
      this.messageInput.disabled = false;
      this.sendBtn.disabled = false;
      this.apiKeyInput.disabled = true;
      this.messageInput.focus();
    } else {
      this.connectBtn.classList.remove("hidden");
      this.disconnectBtn.classList.add("hidden");
      this.messageInput.disabled = true;
      this.sendBtn.disabled = true;
      this.apiKeyInput.disabled = false;
    }
  }
}

// Starta klienten när sidan laddas
document.addEventListener("DOMContentLoaded", () => {
  new WebSocketClient();
});
