let overlayInjected = false;
let idleTimeout = null;
let isIdle = true;
const IDLE_DELAY_MS = 15000; // 15 seconds of no interaction = idle

// Floating timer
let timerEl = null;
let timerStyleEl = null;
let timerInterval = null;
let activeSeconds = 0;

function createTimer() {
  if (timerEl) return;

  timerStyleEl = document.createElement("style");
  timerStyleEl.textContent = `
    #snap-out-timer {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 2147483646;
      background: #292524;
      color: #f5f5f4;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
      font-size: 13px;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid #f5f5f4;
      opacity: 0.85;
      pointer-events: none;
      transition: opacity 0.2s;
    }
  `;
  document.documentElement.appendChild(timerStyleEl);

  timerEl = document.createElement("div");
  timerEl.id = "snap-out-timer";
  timerEl.textContent = "0:00";
  document.documentElement.appendChild(timerEl);

  timerInterval = setInterval(() => {
    if (!isIdle) {
      activeSeconds++;
      const mins = Math.floor(activeSeconds / 60);
      const secs = activeSeconds % 60;
      timerEl.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
    }
  }, 1000);
}

function removeTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (timerEl) {
    timerEl.remove();
    timerEl = null;
  }
  if (timerStyleEl) {
    timerStyleEl.remove();
    timerStyleEl = null;
  }
  activeSeconds = 0;
}

// Start the floating timer immediately
createTimer();

// Notify background that page is active (only on idle → active transition)
function notifyActive() {
  if (isIdle) {
    isIdle = false;
    chrome.runtime.sendMessage({ type: "PAGE_ACTIVE" });
  }
}

function notifyIdle() {
  if (!isIdle) {
    isIdle = true;
    chrome.runtime.sendMessage({ type: "PAGE_IDLE" });
  }
}

// Track user activity
function resetIdleTimer() {
  if (idleTimeout) clearTimeout(idleTimeout);
  notifyActive();
  idleTimeout = setTimeout(() => {
    notifyIdle();
  }, IDLE_DELAY_MS);
}

["mousemove", "keydown", "scroll", "click", "touchstart"].forEach((evt) => {
  document.addEventListener(evt, resetIdleTimer, { passive: true });
});

// Start tracking on load
resetIdleTimer();

// Handle visibility changes
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    notifyIdle();
    if (idleTimeout) clearTimeout(idleTimeout);
  } else {
    resetIdleTimer();
  }
});

// Listen for overlay trigger from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SHOW_OVERLAY" && !overlayInjected) {
    showOverlay();
  }
});

function showOverlay() {
  overlayInjected = true;
  removeTimer();

  chrome.runtime.sendMessage({ type: "GET_CONFIG" }, (config) => {
    if (chrome.runtime.lastError || !config) return;

    const backdrop = document.createElement("div");
    backdrop.id = "snap-out-backdrop";

    const panel = document.createElement("div");
    panel.id = "snap-out-panel";

    const title = document.createElement("h2");
    title.textContent = "Snap Out!";
    title.id = "snap-out-title";

    const message = document.createElement("p");
    message.textContent = config.message;
    message.id = "snap-out-message";

    const linksContainer = document.createElement("div");
    linksContainer.id = "snap-out-links";

    const linksLabel = document.createElement("p");
    linksLabel.textContent = "Do something productive instead:";
    linksLabel.id = "snap-out-links-label";
    linksContainer.appendChild(linksLabel);

    config.quickLinks.forEach((link) => {
      const a = document.createElement("a");
      a.href = link.url;
      a.textContent = link.name;
      a.className = "snap-out-link";
      a.target = "_self";
      linksContainer.appendChild(a);
    });

    const dismissBtn = document.createElement("button");
    dismissBtn.textContent = "1 more minute...";
    dismissBtn.id = "snap-out-dismiss";
    dismissBtn.addEventListener("click", () => {
      backdrop.remove();
      style.remove();
      overlayInjected = false;
      chrome.runtime.sendMessage({ type: "RESET_TIMER" });
      createTimer();
    });

    panel.appendChild(title);
    panel.appendChild(message);
    panel.appendChild(linksContainer);
    panel.appendChild(dismissBtn);
    backdrop.appendChild(panel);

    const style = document.createElement("style");
    style.textContent = `
      #snap-out-backdrop {
        position: fixed;
        inset: 0;
        background: #292524;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        animation: snap-out-fadein 0.3s ease;
      }
      @keyframes snap-out-fadein {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      #snap-out-panel {
        background: #292524;
        border: 2px solid #f5f5f4;
        border-radius: 16px;
        padding: 40px;
        max-width: 440px;
        width: 90%;
        text-align: center;
      }
      #snap-out-title {
        color: #f5f5f4;
        font-size: 28px;
        margin: 0 0 12px 0;
        font-weight: 700;
      }
      #snap-out-message {
        color: #f5f5f4;
        font-size: 18px;
        margin: 0 0 28px 0;
        line-height: 1.5;
      }
      #snap-out-links {
        margin-bottom: 24px;
      }
      #snap-out-links-label {
        color: #f5f5f4;
        font-size: 13px;
        margin: 0 0 12px 0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        opacity: 0.6;
      }
      .snap-out-link {
        display: inline-block;
        background: #f5f5f4;
        color: #292524 !important;
        text-decoration: none !important;
        padding: 10px 20px;
        border-radius: 8px;
        margin: 4px;
        font-size: 14px;
        font-weight: 600;
        border: none;
        transition: all 0.2s;
      }
      .snap-out-link:hover {
        opacity: 0.85;
        transform: translateY(-1px);
      }
      #snap-out-dismiss {
        background: transparent;
        color: #f5f5f4;
        border: 1px solid #f5f5f4;
        padding: 10px 24px;
        border-radius: 8px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
        margin-top: 8px;
        opacity: 0.4;
      }
      #snap-out-dismiss:hover {
        opacity: 0.7;
      }
    `;

    document.documentElement.appendChild(style);
    document.documentElement.appendChild(backdrop);
  });
}
