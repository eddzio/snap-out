const DEFAULTS = {
  timeLimitMinutes: 1,
  message: "Is this the best use of your time right now?",
  quickLinks: [
    { name: "Medium - My Stories", url: "https://medium.com/me/stories" }
  ]
};

const linksList = document.getElementById("links-list");
const addLinkBtn = document.getElementById("add-link-btn");
const saveBtn = document.getElementById("save-btn");
const toast = document.getElementById("toast");
const messageInput = document.getElementById("message");
const customMinutes = document.getElementById("custom-minutes");
const timeOptions = document.querySelectorAll(".time-option");

let selectedMinutes = DEFAULTS.timeLimitMinutes;

// Load saved settings
chrome.storage.sync.get(null, (data) => {
  selectedMinutes = data.timeLimitMinutes ?? DEFAULTS.timeLimitMinutes;
  messageInput.value = data.message ?? DEFAULTS.message;
  const links = data.quickLinks ?? DEFAULTS.quickLinks;

  links.forEach((link) => addLinkRow(link.name, link.url));

  updateTimeSelection();
});

function updateTimeSelection() {
  timeOptions.forEach((opt) => {
    const mins = parseInt(opt.dataset.minutes, 10);
    opt.classList.toggle("selected", mins === selectedMinutes);
  });

  if (![1, 3].includes(selectedMinutes)) {
    customMinutes.value = selectedMinutes;
    timeOptions.forEach((opt) => opt.classList.remove("selected"));
  } else {
    customMinutes.value = "";
  }
}

timeOptions.forEach((opt) => {
  opt.addEventListener("click", () => {
    selectedMinutes = parseInt(opt.dataset.minutes, 10);
    customMinutes.value = "";
    updateTimeSelection();
  });
});

customMinutes.addEventListener("input", () => {
  const val = parseInt(customMinutes.value, 10);
  if (val > 0) {
    selectedMinutes = val;
    timeOptions.forEach((opt) => opt.classList.remove("selected"));
  }
});

function addLinkRow(name = "", url = "") {
  const row = document.createElement("div");
  row.className = "link-row";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Name";
  nameInput.value = name;

  const urlInput = document.createElement("input");
  urlInput.type = "url";
  urlInput.placeholder = "https://...";
  urlInput.value = url;

  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-link";
  removeBtn.textContent = "\u00d7";
  removeBtn.addEventListener("click", () => row.remove());

  row.appendChild(nameInput);
  row.appendChild(urlInput);
  row.appendChild(removeBtn);
  linksList.appendChild(row);
}

addLinkBtn.addEventListener("click", () => addLinkRow());

function isValidUrl(str) {
  try {
    const parsed = new URL(str);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

saveBtn.addEventListener("click", () => {
  const links = [];
  let hasInvalidUrl = false;
  linksList.querySelectorAll(".link-row").forEach((row) => {
    const inputs = row.querySelectorAll("input");
    const name = inputs[0].value.trim();
    const url = inputs[1].value.trim();
    if (name && url) {
      if (!isValidUrl(url)) {
        hasInvalidUrl = true;
        inputs[1].style.borderColor = "#ef4444";
      } else {
        inputs[1].style.borderColor = "";
        links.push({ name, url });
      }
    }
  });

  if (hasInvalidUrl) {
    toast.textContent = "Invalid URL: must start with http:// or https://";
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
      toast.textContent = "Settings saved!";
    }, 3000);
    return;
  }

  chrome.storage.sync.set({
    timeLimitMinutes: selectedMinutes,
    message: messageInput.value.trim() || DEFAULTS.message,
    quickLinks: links.length > 0 ? links : DEFAULTS.quickLinks
  }, () => {
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2000);
  });
});
