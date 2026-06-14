const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginSection = document.querySelector('.login-section');
const userSection = document.querySelector('.user-section');
const userName = document.getElementById('userName');
const userGithubId = document.getElementById('userGithubId');
const status = document.getElementById('status');

loginBtn.addEventListener('click', loginWithGitHub);
logoutBtn.addEventListener('click', handleLogout);

function loginWithGitHub() {
  loginBtn.disabled = true;
  showStatus('Redirecting to GitHub...', 'loading');

  // Send message to background script to start OAuth flow
  chrome.runtime.sendMessage({ action: 'PERFORM_OAUTH' }, (response) => {
    if (!response || !response.success) {
      showStatus('Failed to start login', 'error');
      loginBtn.disabled = false;
    }
  });

  // Listen for login success/error messages from background script
  const messageListener = (request) => {
    if (request.action === 'LOGIN_SUCCESS') {
      console.log('Login successful:', request.user);
      displayUserInfo(request.user);
      showStatus('Logged in successfully!', 'success');
      setTimeout(() => hideStatus(), 1500);
      loginBtn.disabled = false;
      chrome.runtime.onMessage.removeListener(messageListener);
    } else if (request.action === 'LOGIN_ERROR') {
      console.error('Login error:', request.message);
      showStatus(`Login error: ${request.message}`, 'error');
      loginBtn.disabled = false;
      chrome.runtime.onMessage.removeListener(messageListener);
    }
  };

  chrome.runtime.onMessage.addListener(messageListener);

  // Timeout after 5 minutes
  setTimeout(() => {
    chrome.runtime.onMessage.removeListener(messageListener);
  }, 5 * 60 * 1000);
}

function handleLogout() {
  logoutBtn.disabled = true;
  chrome.runtime.sendMessage({ action: 'LOGOUT' }, () => {
    loginSection.classList.add('active');
    userSection.classList.remove('active');
    loginBtn.disabled = false;
    logoutBtn.disabled = false;
    hideStatus();
  });
}

function showStatus(message, type) {
  status.textContent = message;
  status.className = `status ${type}`;
  status.style.display = 'block';
}

function hideStatus() {
  status.style.display = 'none';
}

function checkAuthentication() {
  chrome.storage.local.get(['user', 'token', 'accessToken'], (result) => {
    if ((result.token || result.accessToken) && result.user) {
      displayUserInfo(result.user);
    } else {
      showStatus('Login verification failed', 'error');
      loginBtn.disabled = false;
    }
  });
}

function displayUserInfo(user) {
  if (user && user.githubId) {
    userName.textContent = user.githubId || 'User';
    userGithubId.textContent = `ID: ${user.userId || 'Unknown'}`;

    loginSection.classList.remove('active');
    userSection.classList.add('active');
    hideStatus();
  }
}

// Load user data on popup open
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['user', 'token', 'accessToken'], (result) => {
    if ((result.token || result.accessToken) && result.user) {
      displayUserInfo(result.user);
    } else {
      loginBtn.disabled = false;
    }
  });
});


