function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, 2000);
}

// Real-time license check on popup load
chrome.storage.local.get(["license_key"], async (res) => {
  const key = res.license_key;
  if (!key) return disableAllButtons();

  const device_id = await getDeviceId();
  fetch("https://aura.codebhai.xyz/verify_license.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ license_key: key, device_id })
  })
  .then(res => res.json())
  .then(data => {
    if (data.status !== "valid") {
      disableAllButtons();
      showToast("Activate license to use this extension.");
    }
  })
  .catch(() => {
    disableAllButtons();
    showToast("License check failed.");
  });
});

function disableAllButtons() {
  const buttons = document.querySelectorAll("button");
  buttons.forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = 0.5;
    btn.style.cursor = "not-allowed";
  });
}

function parseCard(cardString) {
  const [number, mm, yyyy, cvv] = cardString.split("|");
  return {
    number,
    expiry: mm + "/" + yyyy.slice(2),
    cvv,
    name: "CodeX Admin"
  };
}

function autofillCard(card) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0].id;
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (card) => {
        const fill = (selector, value) => {
          const el = document.querySelector(selector);
          if (el) {
            el.focus();
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        };
        fill('input[name="cardNumber"]', card.number);
        fill('input[name="expiration"]', card.expiry);
        fill('input[name="securityCode"]', card.cvv);
        fill('input[name="firstName"]', card.name);
      },
      args: [card]
    }, () => showToast("Card autofilled!"));
  });
}

function useCardFromStorage(type) {
  chrome.storage.local.get([type], (result) => {
    const cards = result[type] || [];
    if (cards.length === 0) {
      showToast("No cards saved for type: " + type);
      return;
    }
    const cardStr = cards.shift();
    const card = parseCard(cardStr);
    autofillCard(card);
    chrome.storage.local.set({ [type]: cards }, () => {
      if (cards.length === 0) {
        showToast("All " + type + " cards used. Please add more.");
      }
    });
  });
}

document.getElementById("declined").addEventListener("click", () => useCardFromStorage("declined_cards"));
document.getElementById("real").addEventListener("click", () => useCardFromStorage("real_cards"));

document.getElementById("addTaxID").addEventListener("click", () => {
  const taxID = generateTaxID();
  fillTaxID(taxID);
});

function generateTaxID() {
  const randomNumber = Math.floor(Math.random() * 1e13);
  return randomNumber.toString().padStart(13, "0");
}

function fillTaxID(taxID) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0].id;
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (taxID) => {
        const el = document.querySelector('input[name="taxID"]');
        if (el) {
          el.value = taxID;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      },
      args: [taxID]
    }, () => showToast("Tax ID filled!"));
  });
}

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
