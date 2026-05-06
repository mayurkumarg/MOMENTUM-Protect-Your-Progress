console.log('🔥 Background script started');
const BACKEND_AUTH_URL = 'http://localhost:5000/api/auth/github';

// Universal message logger to help debug delivery
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📩 Message received:', message);
  return true;
});

function performOAuth() {
  chrome.identity.launchWebAuthFlow(
    {
      url: BACKEND_AUTH_URL,
      interactive: true,
    },
    function (redirectUrl) {
      if (chrome.runtime.lastError) {
        console.error('OAuth error:', chrome.runtime.lastError);
        notifyPopup({
          action: 'LOGIN_ERROR',
          message: chrome.runtime.lastError.message,
        });
        return;
      }

      if (!redirectUrl) {
        console.error('No redirect URL received');
        notifyPopup({
          action: 'LOGIN_ERROR',
          message: 'No redirect URL received',
        });
        return;
      }

      console.log('Redirect URL:', redirectUrl);

      try {
        const url = new URL(redirectUrl);
        const token = url.searchParams.get('token');

        if (!token) {
          console.error('Token not found in redirect URL');
          notifyPopup({
            action: 'LOGIN_ERROR',
            message: 'Token not found in redirect URL',
          });
          return;
        }

        // Decode JWT to get user info
        const user = decodeJWT(token);

        chrome.storage.local.set({ token, user }, () => {
          console.log('Token and user stored successfully');
          notifyPopup({
            action: 'LOGIN_SUCCESS',
            user,
          });
        });
      } catch (error) {
        console.error('Error parsing redirect URL:', error);
        notifyPopup({
          action: 'LOGIN_ERROR',
          message: 'Error parsing redirect URL',
        });
      }
    }
  );
}

function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const payload = JSON.parse(atob(parts[1]));
    return {
      userId: payload.userId,
      githubId: payload.githubId,
    };
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
}

function notifyPopup(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Popup may not be open
    console.log('Popup not open, message queued');
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'PERFORM_OAUTH') {
    performOAuth();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'GET_TOKEN') {
    chrome.storage.local.get('token', (result) => {
      sendResponse({ token: result.token || null });
    });
    return true;
  }

  if (request.action === 'LOGOUT') {
    chrome.storage.local.remove(['token', 'user'], () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.token) {
    console.log('Token updated in storage');
  }
});

// Listen for PROBLEM_SOLVED messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PROBLEM_SOLVED') {
    console.log('🔥 PROBLEM_SOLVED received:', message.data);

    sendToBackend(message.data)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((err) => {
        console.error('❌ Error sending:', err);
        sendResponse({ success: false });
      });

    return true; // keep the message channel open for async response
  }
});

// Send solved problem to backend API
async function sendToBackend(data) {
  try {
    const stored = await new Promise((resolve) =>
      chrome.storage.local.get('token', resolve)
    );

    if (!stored.token) {
      console.error('❌ No token found — user is not logged in. DSA activity not saved.');
      return;
    }

    const res = await fetch('http://localhost:5000/api/dsa/activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stored.token}`,
      },
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (res.ok) {
      console.log('✅ DSA activity saved successfully:', result);
    } else {
      console.error(`❌ Backend returned ${res.status}:`, result.message || result);
    }
  } catch (error) {
    console.error('❌ Network/fetch error — is the backend running?', error);
  }
}

