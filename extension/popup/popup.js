const loginBtn = document.getElementById('loginBtn');
const loginBtnLabel = loginBtn.querySelector('.btn-label');
const logoutBtn = document.getElementById('logoutBtn');
const loginSection = document.querySelector('.login-section');
const userSection = document.querySelector('.user-section');
const userName = document.getElementById('userName');
const userGithubId = document.getElementById('userGithubId');
const status = document.getElementById('status');
const syncStatusIndicator = document.getElementById('syncStatusIndicator');

function updateSyncStatusUI(syncStatus) {
  if (!syncStatusIndicator) return;
  
  if (!syncStatus) {
    syncStatusIndicator.textContent = 'Status: Unknown';
    syncStatusIndicator.className = 'status loading';
    return;
  }

  const state = syncStatus.state || 'Idle';
  const count = syncStatus.pendingCount || 0;

  if (state === 'Syncing') {
    syncStatusIndicator.textContent = 'Syncing...';
    syncStatusIndicator.className = 'status loading';
  } else if (state === 'Offline') {
    syncStatusIndicator.textContent = `Offline (${count} pending)`;
    syncStatusIndicator.className = 'status error';
  } else if (state === 'Error') {
    syncStatusIndicator.textContent = `Backend Unavailable`;
    syncStatusIndicator.className = 'status error';
  } else {
    syncStatusIndicator.textContent = count > 0 ? `Connected (${count} pending)` : 'Connected & Synced';
    syncStatusIndicator.className = 'status success';
  }
}

// Listen for live updates
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.syncStatus) {
    updateSyncStatusUI(changes.syncStatus.newValue);
  }
});

loginBtn.addEventListener('click', loginWithGitHub);
logoutBtn.addEventListener('click', handleLogout);

function setLoginButtonLoading(isLoading) {
  loginBtn.disabled = isLoading;
  loginBtn.classList.toggle('is-loading', isLoading);
  loginBtnLabel.textContent = isLoading ? 'Redirecting to GitHub…' : 'Login with GitHub';
}

function loginWithGitHub() {
  setLoginButtonLoading(true);
  showStatus('Waiting for GitHub authorization...', 'loading');

  chrome.runtime.sendMessage({ action: 'PERFORM_OAUTH' }, (response) => {
    if (!response || !response.success) {
      showStatus('Failed to start login', 'error');
      setLoginButtonLoading(false);
    }
  });

  const messageListener = (request) => {
    if (request.action === 'LOGIN_SUCCESS') {
      console.log('Login successful:', request.user);
      displayUserInfo(request.user);
      showStatus('Logged in successfully!', 'success');
      setTimeout(() => hideStatus(), 1500);
      setLoginButtonLoading(false);
      chrome.runtime.onMessage.removeListener(messageListener);
    } else if (request.action === 'LOGIN_ERROR') {
      console.error('Login error:', request.message);
      showStatus(`Login error: ${request.message}`, 'error');
      setLoginButtonLoading(false);
      chrome.runtime.onMessage.removeListener(messageListener);
    }
  };

  chrome.runtime.onMessage.addListener(messageListener);

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

function displayUserInfo(user) {
  if (user && user.userId) {
    userName.textContent = user.githubId || 'User';
    userGithubId.textContent = `ID: ${user.userId || 'Unknown'}`;

    loginSection.classList.remove('active');
    userSection.classList.add('active');
    hideStatus();
  }
}

// Load user data on popup open
document.addEventListener('DOMContentLoaded', () => {
  chrome.runtime.sendMessage({ action: 'GET_STATUS' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }
    if (response && response.isAuthenticated && response.user) {
      displayUserInfo(response.user);
    } else {
      loginSection.classList.add('active');
      userSection.classList.remove('active');
      loginBtn.disabled = false;
    }
  });

  chrome.storage.local.get(['syncStatus'], (result) => {
    updateSyncStatusUI(result.syncStatus);
  });
});
