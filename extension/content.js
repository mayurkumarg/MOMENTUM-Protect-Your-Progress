// Utility to get token from storage
function getTokenFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['token', 'accessToken'], (result) => {
      resolve(result.token || result.accessToken || null);
    });
  });
}

// Intercept fetch requests to add auth header
const originalFetch = window.fetch;

window.fetch = async function (...args) {
  let url = args[0];
  let options = args[1] || {};

  if (url instanceof Request) {
    url = url.url;
  }

  // Add auth header for API calls to backend/frontend
  if (
    typeof url === 'string' &&
    (url.includes('localhost:5000') || url.includes('localhost:3000'))
  ) {
    const token = await getTokenFromStorage();
    if (token) {
      options.headers = options.headers || {};
      options.headers.Authorization = `Bearer ${token}`;
    }
  }

  return originalFetch.apply(this, args);
};

// Intercept XMLHttpRequest to add auth header
const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (method, url, ...args) {
  this._url = url;
  this._method = method;
  return originalOpen.apply(this, [method, url, ...args]);
};

XMLHttpRequest.prototype.send = async function (...args) {
  if (
    typeof this._url === 'string' &&
    (this._url.includes('localhost:5000') || this._url.includes('localhost:3000'))
  ) {
    const token = await getTokenFromStorage();
    if (token) {
      this.setRequestHeader('Authorization', `Bearer ${token}`);
    }
  }

  return originalSend.apply(this, args);
};

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.token) {
    console.log('Token updated in storage');
  }
});

