chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["license_key", "license_status"], async (result) => {
    if (result.license_status !== "valid") {
      chrome.tabs.create({ url: chrome.runtime.getURL("license.html") });
    }
  });
});
