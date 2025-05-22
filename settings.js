function isValidCard(card) {
  const parts = card.split("|");
  return parts.length === 4 &&
    /^\d{13,19}$/.test(parts[0]) && // Card number
    /^\d{2}$/.test(parts[1]) &&     // MM
    /^\d{4}$/.test(parts[2]) &&     // YYYY
    /^\d{3,4}$/.test(parts[3]);     // CVV
}

function saveCards(inputId, storageKey, successMsg) {
  const raw = document.getElementById(inputId).value.trim();
  const lines = raw.split("\n");
  const validCards = lines
    .map(line => line.trim())
    .filter(line => isValidCard(line));

  chrome.storage.local.set({ [storageKey]: validCards }, () => {
    showToast(successMsg);
    updateCardCounts();
  });
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, 2000);
}

function updateCardCounts() {
  chrome.storage.local.get(["declined_cards", "real_cards"], (data) => {
    document.querySelector("#declinedCount span").textContent = (data.declined_cards || []).length;
    document.querySelector("#realCount span").textContent = (data.real_cards || []).length;
  });
}

function disableBinControls() {
  const elements = [
    document.getElementById("declineInput"),
    document.getElementById("realInput"),
    document.getElementById("saveDeclined"),
    document.getElementById("saveReal")
  ];
  elements.forEach(el => {
    if (el) {
      el.disabled = true;
      el.style.opacity = 0.5;
      el.style.cursor = "not-allowed";
    }
  });
}

function formatTimeRemaining(expiryISOString) {
  const expiry = new Date(expiryISOString);
  const now = new Date();
  const diffMs = expiry - now;

  if (diffMs <= 0) return "Expired";

  const diffSec = Math.floor(diffMs / 1000);
  const days = Math.floor(diffSec / (3600 * 24));
  const hours = Math.floor((diffSec % (3600 * 24)) / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);

  let result = [];
  if (days > 0) result.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) result.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (days === 0 && hours === 0 && minutes > 0)
    result.push(`${minutes} min`);

  return result.join(" ");
}

async function updateLicenseInfo() {
  const statusElem = document.querySelector(".license-status");
  const keyElem = document.querySelector(".license-key");
  const expiryElem = document.querySelector(".license-expiry");

  chrome.storage.local.get(["license_key"], async (res) => {
    const key = res.license_key;
    if (!key) {
      statusElem.textContent = "Invalid";
      keyElem.textContent = "—";
      expiryElem.textContent = "—";
      document.getElementById("licenseWarning").style.display = "block";
      disableBinControls();
      return;
    }

    const device_id = await getDeviceId();
    fetch("https://aura.codebhai.xyz/verify_license.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ license_key: key, device_id })
    })
    .then(res => res.json())
    .then(data => {
      if (data.status === "valid") {
        statusElem.textContent = "Valid";
        statusElem.style.color = "#34d399";
        keyElem.textContent = key;
        expiryElem.textContent = formatTimeRemaining(data.expiry || "");
        chrome.storage.local.set({ license_status: "valid", license_expiry: data.expiry });
        document.getElementById("licenseWarning").style.display = "none";
      } else {
        statusElem.textContent = "Invalid";
        statusElem.style.color = "#f87171";
        keyElem.textContent = key;
        expiryElem.textContent = "—";
        chrome.storage.local.set({ license_status: "invalid" });
        document.getElementById("licenseWarning").style.display = "block";
        disableBinControls();
      }
    })
    .catch(() => {
      statusElem.textContent = "Server error";
      statusElem.style.color = "#f87171";
      document.getElementById("licenseWarning").style.display = "block";
      disableBinControls();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  updateCardCounts();
  updateLicenseInfo();

  document.getElementById("saveDeclined").addEventListener("click", () =>
    saveCards("declineInput", "declined_cards", "Declined cards saved!")
  );

  document.getElementById("saveReal").addEventListener("click", () =>
    saveCards("realInput", "real_cards", "Real cards saved!")
  );

  // fix CSP-safe navigation
  const licenseBtn = document.getElementById("openLicenseBtn");
  if (licenseBtn) {
    licenseBtn.addEventListener("click", () => {
      window.open("license.html");
    });
  }
});

async function getDeviceId() {
  const info = await chrome.runtime.getPlatformInfo();
  const userAgent = navigator.userAgent;
  const raw = info.os + "_" + userAgent;

  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
