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

  chrome.identity.launchWebAuthFlow(
    {
      url: 'http://localhost:5000/api/auth/github',
      interactive: true,
    },
    function (redirectUrl) {
      if (chrome.runtime.lastError) {
        console.error('OAuth error:', chrome.runtime.lastError);
        showStatus(`Login error: ${chrome.runtime.lastError.message}`, 'error');
        loginBtn.disabled = false;
        return;
      }

      if (!redirectUrl) {
        console.error('No redirect URL received');
        showStatus('Login failed: no redirect URL', 'error');
        loginBtn.disabled = false;
        return;
      }

      try {
        const url = new URL(redirectUrl);
        const token = url.searchParams.get('token');
        console.log('Extracted token:', token);

        if (!token) {
          console.error('Token not found in redirect URL');
          showStatus('Login failed: token missing', 'error');
          loginBtn.disabled = false;
          return;
        }

        chrome.storage.local.set({ token }, () => {
          console.log('Token stored successfully');
          // decode minimal user info from JWT payload
          try {
            const parts = token.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(atob(parts[1]));
              const user = { userId: payload.userId, githubId: payload.githubId };
              chrome.storage.local.set({ user }, () => {
                displayUserInfo(user);
                showStatus('Logged in successfully!', 'success');
                setTimeout(() => hideStatus(), 1500);
                loginBtn.disabled = false;
              });
            } else {
              // no user info available
              showStatus('Logged in (no user info)', 'success');
              setTimeout(() => hideStatus(), 1500);
              loginBtn.disabled = false;
            }
          } catch (err) {
            console.error('Error decoding token payload', err);
            showStatus('Logged in', 'success');
            setTimeout(() => hideStatus(), 1500);
            loginBtn.disabled = false;
          }
        });
      } catch (err) {
        console.error('Error parsing redirect URL:', err);
        showStatus('Login failed: invalid redirect', 'error');
        loginBtn.disabled = false;
      }
    }
  );
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
  chrome.storage.local.get(['user', 'token'], (result) => {
    if (result.token && result.user) {
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
  chrome.storage.local.get(['user', 'token'], (result) => {
    if (result.token && result.user) {
      displayUserInfo(result.user);
    } else {
      loginBtn.disabled = false;
    }
  });
});


