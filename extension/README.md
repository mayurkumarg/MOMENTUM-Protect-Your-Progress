# Momentum Chrome Extension

## Setup

1. **Open Chrome Extensions Manager**
   - Navigate to: `chrome://extensions/`

2. **Enable Developer Mode**
   - Toggle "Developer mode" in the top-right corner

3. **Load Extension**
   - Click "Load unpacked"
   - Select this `extension` folder

## Configuration

### Backend OAuth URLs

Update in `background.js`:
```javascript
const BACKEND_AUTH_URL = 'http://localhost:5000/api/auth/github';
const REDIRECT_URL = 'http://localhost:3000/auth/success';
```

### GitHub OAuth Application

1. Go to: https://github.com/settings/developers
2. Create new OAuth App with:
   - **Authorization callback URL**: `http://localhost:5000/api/auth/github/callback`
3. Copy Client ID and Client Secret
4. Add to backend `.env`:
   ```
   GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   GITHUB_REDIRECT_URI=http://localhost:5000/api/auth/github/callback
   ```

## How It Works

### Login Flow
1. User clicks "Login with GitHub" in extension popup
2. Extension redirects to backend OAuth endpoint
3. Backend exchanges code for GitHub token
4. Backend returns JWT to frontend
5. Token stored in `chrome.storage.local`

### API Calls
- All requests to `http://localhost:5000` and `http://localhost:3000` automatically include:
  ```
  Authorization: Bearer <JWT_TOKEN>
  ```

### Logout
- User clicks "Logout"
- Token and user data cleared from storage
- Extension returns to login screen

## Files

- **manifest.json** - Extension configuration
- **popup.html** - Extension UI
- **popup.js** - Popup interactions
- **background.js** - OAuth flow & token management
- **content.js** - API request interceptor

## Troubleshooting

### "Cannot find module" errors
- Check that extension folder contains all required files

### Token not persisting
- Ensure `chrome.storage.local` permissions are in manifest.json

### Auth header not added to requests
- Verify `content_scripts` is configured in manifest.json
- Check that request URLs match host_permissions
