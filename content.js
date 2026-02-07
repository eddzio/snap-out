let overlayInjected = false;
let idleTimeout = null;
const IDLE_DELAY_MS = 15000; // 15 seconds of no interaction = idle

// Notify background that page is active
function notifyActive() {
  chrome.runtime.sendMessage({ type: "PAGE_ACTIVE" });
}

function notifyIdle() {
  chrome.runtime.sendMessage({ type: "PAGE_IDLE" });
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
    dismissBtn.textContent = "5 more minutes...";
    dismissBtn.id = "snap-out-dismiss";
    dismissBtn.addEventListener("click", () => {
      backdrop.remove();
      style.remove();
      overlayInjected = false;
      chrome.runtime.sendMessage({ type: "RESET_TIMER" });
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
        background: rgba(0, 0, 0, 0.85);
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
        background: #1a1a2e;
        border: 1px solid #333;
        border-radius: 16px;
        padding: 40px;
        max-width: 440px;
        width: 90%;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      }
      #snap-out-title {
        color: #ff6b6b;
        font-size: 28px;
        margin: 0 0 12px 0;
        font-weight: 700;
      }
      #snap-out-message {
        color: #e0e0e0;
        font-size: 18px;
        margin: 0 0 28px 0;
        line-height: 1.5;
      }
      #snap-out-links {
        margin-bottom: 24px;
      }
      #snap-out-links-label {
        color: #888;
        font-size: 13px;
        margin: 0 0 12px 0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .snap-out-link {
        display: inline-block;
        background: #16213e;
        color: #4fc3f7 !important;
        text-decoration: none !important;
        padding: 10px 20px;
        border-radius: 8px;
        margin: 4px;
        font-size: 14px;
        font-weight: 500;
        border: 1px solid #2a3a5c;
        transition: all 0.2s;
      }
      .snap-out-link:hover {
        background: #1a2744;
        border-color: #4fc3f7;
        transform: translateY(-1px);
      }
      #snap-out-dismiss {
        background: transparent;
        color: #666;
        border: 1px solid #333;
        padding: 10px 24px;
        border-radius: 8px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
        margin-top: 8px;
      }
      #snap-out-dismiss:hover {
        color: #999;
        border-color: #555;
      }
    `;

    document.documentElement.appendChild(style);
    document.documentElement.appendChild(backdrop);
  });
}
