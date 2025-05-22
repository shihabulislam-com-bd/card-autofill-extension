document.getElementById("submitLicense").addEventListener("click", async () => {
  const key = document.getElementById("licenseKey").value.trim();
  const message = document.getElementById("message");

  if (!key) {
    message.textContent = "Please enter a license key.";
    message.className = "error";
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
      chrome.storage.local.set({ license_key: key, license_status: "valid" }, () => {
        message.textContent = "License activated successfully!";
        message.className = "success";
        setTimeout(() => window.close(), 1500);
      });
    } else {
      message.textContent = "Invalid or expired license.";
      message.className = "error";
      chrome.storage.local.set({ license_status: "invalid" });
    }
  })
  .catch(() => {
    message.textContent = "Server error. Please try again.";
    message.className = "error";
  });
});

// Generate consistent device ID hash
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
