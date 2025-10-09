class WebSocketClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.accessToken = localStorage.getItem("access_token") || "";
    this.refreshToken = localStorage.getItem("refresh_token") || "";
    this.loginApiUrl = "https://login-usop.onrender.com"; // Login API URL
    this.refreshTimer = null;
    this.initializeElements();
    this.bindEvents();
    this.loadSavedTokens();
  }

  initializeElements() {
    // Login-formulär elements
    this.loginSection = document.getElementById("loginSection");
    this.authSection = document.getElementById("authSection");
    this.usernameInput = document.getElementById("usernameInput");
    this.passwordInput = document.getElementById("passwordInput");
    this.loginBtn = document.getElementById("loginBtn");

    // Auth-section elements
    this.apiKeyInput = document.getElementById("apiKeyInput");
    this.connectBtn = document.getElementById("connectBtn");
    this.logoutBtn = document.getElementById("logoutBtn");

    // App elements
    this.status = document.getElementById("status");
    this.chatContainer = document.getElementById("chatContainer");
    this.messageInput = document.getElementById("messageInput");
    this.sendBtn = document.getElementById("sendBtn");
  }

  bindEvents() {
    // Login events
    this.loginBtn.addEventListener("click", () => this.login());
    this.passwordInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.login();
      }
    });

    // Auth events
    this.connectBtn.addEventListener("click", () => this.connect());
    this.logoutBtn.addEventListener("click", () => this.logout());

    // Message events
    this.sendBtn.addEventListener("click", () => this.sendMessage());
    this.messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.sendMessage();
      }
    });

    // Token input event
    this.apiKeyInput.addEventListener("input", () => {
      this.accessToken = this.apiKeyInput.value.trim();
      if (this.accessToken) {
        localStorage.setItem("access_token", this.accessToken);
      }
    });
  }

  loadSavedTokens() {
    if (this.accessToken && this.refreshToken) {
      // Har tokens - visa auth section
      this.apiKeyInput.value = this.accessToken;
      this.showAuthSection();
      this.tryAutoConnect();
    } else {
      // Inga tokens - visa login section
      this.showLoginSection();
    }
  }

  showLoginSection() {
    this.loginSection.classList.remove("hidden");
    this.authSection.classList.add("hidden");
  }

  showAuthSection() {
    this.loginSection.classList.add("hidden");
    this.authSection.classList.remove("hidden");
  }

  async login() {
    const username = this.usernameInput.value.trim();
    const password = this.passwordInput.value.trim();

    if (!username || !password) {
      alert("Ange både användarnamn och lösenord");
      return;
    }

    // Visa loading state
    this.loginBtn.disabled = true;
    this.loginBtn.textContent = "Loggar in...";

    try {
      const response = await fetch(`${this.loginApiUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        // Spara tokens
        this.saveTokens(data.accessToken, data.refreshToken);

        // Visa auth-section
        this.showAuthSection();

        // Auto-anslut till WebSocket
        this.connect();

        // Rensa login-formulär
        this.usernameInput.value = "";
        this.passwordInput.value = "";

        this.addMessage("system", `Välkommen ${data.user.username}!`);
      } else {
        alert(`Inloggning misslyckades: ${data.message}`);
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("Inloggningsfel. Kontrollera din internetanslutning.");
    } finally {
      // Återställ knapp
      this.loginBtn.disabled = false;
      this.loginBtn.textContent = "Logga in";
    }
  }

  saveTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    this.apiKeyInput.value = accessToken;
  }

  clearTokens() {
    this.accessToken = "";
    this.refreshToken = "";
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    this.apiKeyInput.value = "";
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async tryAutoConnect() {
    const refreshed = await this.refreshAccessToken();
    if (refreshed) {
      this.connect();
    } else {
      // Om refresh misslyckas, visa login igen
      this.showLoginSection();
    }
  }

  async refreshAccessToken() {
    if (!this.refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.loginApiUrl}/api/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refreshToken: this.refreshToken,
        }),
      });

      const data = await response.json();

      if (data.success) {
        this.saveTokens(data.accessToken, this.refreshToken);
        this.scheduleTokenRefresh();
        return true;
      } else {
        this.clearTokens();
        this.addMessage("system", "Session utgången. Vänligen logga in igen.");
        this.showLoginSection();
        return false;
      }
    } catch (error) {
      console.error("Token refresh error:", error);
      this.clearTokens();
      this.showLoginSection();
      return false;
    }
  }

  scheduleTokenRefresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = setTimeout(async () => {
      const refreshed = await this.refreshAccessToken();
      if (!refreshed && this.isConnected) {
        this.disconnect();
        this.addMessage("system", "Session utgången. Anslutning avbruten.");
      }
    }, 12 * 60 * 1000); // 12 minuter
  }

  connect() {
    const apiKey = this.apiKeyInput.value.trim();

    if (!apiKey) {
      alert("Ingen API-nyckel tillgänglig. Logga in först.");
      this.showLoginSection();
      return;
    }

    this.accessToken = apiKey;
    const serverUrl = "https://project-2-part-1-tvhv.onrender.com/"; // WebSocket server URL

    try {
      this.socket = io(serverUrl, {
        auth: {
          token: this.accessToken,
        },
        extraHeaders: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      this.setupSocketListeners();
      this.updateStatus("Ansluter...", "connecting");
      this.scheduleTokenRefresh();
    } catch (error) {
      this.addMessage("system", `Anslutningsfel: ${error.message}`);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async logout() {
    try {
      if (this.refreshToken) {
        await fetch(`${this.loginApiUrl}/api/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            refreshToken: this.refreshToken,
          }),
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    }

    this.disconnect();
    this.clearTokens();
    this.updateStatus("Utloggad", "disconnected");
    this.toggleControls(false);
    this.showLoginSection();

    // Rensa meddelanden
    this.chatContainer.innerHTML = "";
    this.addMessage("system", "Du har loggat ut.");
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
        alert("Ogiltig API-nyckel. Session utgången.");
        this.showLoginSection();
      }
    });

    this.socket.on("message", (data) => {
      this.addMessage("shared", data.text);
    });

    this.socket.on("chat-message", (data) => {
      this.addMessage("shared", data);
    });

    this.socket.on("broadcast", (data) => {
      this.addMessage("shared", data);
    });
  }

  sendMessage() {
    const message = this.messageInput.value.trim();

    if (!message || !this.isConnected) {
      return;
    }

    this.socket.emit("message", { text: message });
    this.messageInput.value = "";
  }

  addMessage(type, content) {
    const messageDiv = document.createElement("div");
    const timestamp = new Date().toLocaleTimeString("sv-SE");

    if (type === "system") {
      messageDiv.className = "message system";
      messageDiv.innerHTML = `
        <div><strong>System:</strong> ${content}</div>
        <div class="timestamp">${timestamp}</div>
      `;
    } else {
      messageDiv.className = "message shared";
      messageDiv.innerHTML = `
        <div class="message-content">${content}</div>
        <div class="timestamp">${timestamp}</div>
      `;

      const copyBtn = document.createElement("button");
      copyBtn.textContent = "Kopiera";
      copyBtn.className = "copy-btn";
      copyBtn.onclick = () => this.copyToClipboard(content);
      messageDiv.appendChild(copyBtn);
    }

    this.chatContainer.appendChild(messageDiv);
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  copyToClipboard(text) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        const notification = document.createElement("div");
        notification.textContent = "Kopierat!";
        notification.className = "notification";
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 1500);
      })
      .catch(() => {
        alert("Kunde inte kopiera till urklipp");
      });
  }

  updateStatus(text, statusClass) {
    this.status.textContent = text;
    this.status.className = `status ${statusClass}`;
  }

  toggleControls(connected) {
    if (connected) {
      this.connectBtn.classList.add("hidden");
      this.logoutBtn.classList.remove("hidden");
      this.messageInput.disabled = false;
      this.sendBtn.disabled = false;
      this.apiKeyInput.disabled = true;
      this.messageInput.focus();
    } else {
      this.connectBtn.classList.remove("hidden");
      this.logoutBtn.classList.add("hidden");
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
