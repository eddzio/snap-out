const DEFAULTS = {
  timeLimitMinutes: 1,
  message: "Is this the best use of your time right now?",
  quickLinks: [
    { name: "Medium - My Stories", url: "https://medium.com/me/stories" }
  ],
  trackedSites: ["linkedin.com", "facebook.com"]
};

// Track active time per site
const activeTimes = {}; // { tabId: { site, startTime, accumulated } }
let alarmCallbacks = {};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(null, (data) => {
    if (!data.timeLimitMinutes) {
      chrome.storage.sync.set(DEFAULTS);
    }
  });
});

function getSiteFromUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    const sites = ["linkedin.com", "facebook.com"];
    return sites.find((site) => hostname.includes(site)) || null;
  } catch {
    return null;
  }
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (!tabId) return;

  if (msg.type === "PAGE_ACTIVE") {
    const site = getSiteFromUrl(sender.tab.url);
    if (!site) return;

    if (!activeTimes[tabId]) {
      activeTimes[tabId] = { site, startTime: Date.now(), accumulated: 0 };
    } else {
      activeTimes[tabId].startTime = Date.now();
    }
    startCheckAlarm(tabId);
  }

  if (msg.type === "PAGE_IDLE") {
    if (activeTimes[tabId] && activeTimes[tabId].startTime) {
      activeTimes[tabId].accumulated += Date.now() - activeTimes[tabId].startTime;
      activeTimes[tabId].startTime = null;
    }
  }

  if (msg.type === "GET_CONFIG") {
    chrome.storage.sync.get(null, (data) => {
      sendResponse({
        timeLimitMinutes: data.timeLimitMinutes ?? DEFAULTS.timeLimitMinutes,
        message: data.message ?? DEFAULTS.message,
        quickLinks: data.quickLinks ?? DEFAULTS.quickLinks
      });
    });
    return true; // async sendResponse
  }

  if (msg.type === "RESET_TIMER") {
    delete activeTimes[tabId];
  }
});

function startCheckAlarm(tabId) {
  // Check every 5 seconds
  const alarmName = `check_${tabId}`;
  chrome.alarms.create(alarmName, { periodInMinutes: 5 / 60 });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith("check_")) return;
  const tabId = parseInt(alarm.name.replace("check_", ""), 10);
  const entry = activeTimes[tabId];
  if (!entry) {
    chrome.alarms.clear(alarm.name);
    return;
  }

  let total = entry.accumulated;
  if (entry.startTime) {
    total += Date.now() - entry.startTime;
  }

  chrome.storage.sync.get(["timeLimitMinutes"], (data) => {
    const limit = (data.timeLimitMinutes ?? DEFAULTS.timeLimitMinutes) * 60 * 1000;
    if (total >= limit) {
      chrome.tabs.sendMessage(tabId, { type: "SHOW_OVERLAY" }).catch(() => {});
      chrome.alarms.clear(alarm.name);
    }
  });
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  delete activeTimes[tabId];
  chrome.alarms.clear(`check_${tabId}`);
});

// Clean up when tab navigates away from tracked site
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    const site = getSiteFromUrl(changeInfo.url);
    if (!site && activeTimes[tabId]) {
      delete activeTimes[tabId];
      chrome.alarms.clear(`check_${tabId}`);
    }
  }
});
