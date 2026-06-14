# Frontend Authentication System - Quick Start

## Overview
Complete production-ready authentication system with email/password login, GitHub OAuth, JWT tokens, and session management.

## What's Been Built

### Authentication Pages
- **Login Page** (`/login`) - Email + password login, GitHub OAuth button
- **Register Page** (`/register`) - Email/username/password registration with strength indicator
- **GitHub Callback** (`/auth/github/callback`) - GitHub OAuth callback handler

### State Management
- **AuthProvider** - Centralized auth context with automatic session restoration
- **Auth Hooks** - useLogin, useRegister, useLogout helpers

### API Integration
- **Auth API Client** - All endpoints integrated with automatic token refresh
- **Token Management** - Automatic refresh on 401, localStorage storage
- **Protected Routes** - Redirect unauthenticated users to login

### UI Components
- **ProfileMenu** - User avatar, profile info, logout (integrated in sidebar)
- **Loading States** - Auth check, form submissions, token refresh
- **Error Handling** - Field-level and server-level error display

## Environment Setup

### Backend (.env)
```
FRONTEND_URL=http://localhost:5173
GITHUB_REDIRECT_URI=http://localhost:5000/api/auth/github/callback
```

### Frontend (.env.local)
```
VITE_API_BASE_URL=http://localhost:5000/api
```

## Quick Test Flow (5 minutes)

### 1. Start Services
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 2. Register New Account
1. Go to `http://localhost:5173/register`
2. Fill in: email, username, password
3. ✅ Should redirect to `/overview` (authenticated)

### 3. Verify Session
1. Refresh the page
2. ✅ Should stay authenticated (session restored from localStorage)

### 4. Logout and Login
1. Click profile menu (top right)
2. Click "Sign out"
3. ✅ Should redirect to `/login`
4. Login with same credentials
5. ✅ Should redirect to `/overview`

### 5. Test GitHub OAuth (if configured)
1. Go to `/login`
2. Click "Continue with GitHub"
3. ✅ Should redirect to GitHub auth page
4. Authorize the app
5. ✅ Should redirect to `/auth/github/callback` → `/overview`

## File Structure

```
frontend/src/
├── auth/
│   ├── AuthProvider.jsx      # Central auth state management
│   ├── ProtectedRoute.jsx    # Route protection wrapper
│   ├── hooks.js              # useLogin, useRegister, useLogout
│   ├── validation.js         # Email, username, password validation
│   └── token.js              # JWT token utilities
├── pages/
│   ├── Login.jsx             # Login page
│   ├── Register.jsx          # Registration page
│   └── GitHubCallback.jsx    # GitHub OAuth callback
├── api/
│   ├── auth.js               # Auth endpoints
│   ├── client.js             # API client with token refresh
│   └── index.js              # API client exports
└── components/layout/
    └── ProfileMenu.jsx        # Profile dropdown (in sidebar)
```

## Key Features

✅ **Email + Password Auth**
- Registration with validation
- Login with credentials
- Password strength indicator

✅ **GitHub OAuth**
- Seamless GitHub integration
- Callback handling
- Auto-login on existing GitHub account

✅ **Token Management**
- JWT access tokens (15 min expiry)
- Refresh tokens (30 day expiry)
- Automatic refresh on 401
- localStorage storage

✅ **Session Management**
- Automatic session restoration on page load
- Cross-tab session sync via localStorage events
- Automatic logout on token expiry (checked every 30s)
- Manual logout with token cleanup

✅ **Protected Routes**
- Redirect unauthenticated users to `/login`
- Show loading state during auth check
- Preserve original URL with searchParams

✅ **Error Handling**
- Field-level validation errors
- Server error messages
- Network error recovery
- Clear error states

## Testing Checklist

- [ ] Registration with valid data
- [ ] Registration validation (password, email, username)
- [ ] Login with correct credentials
- [ ] Login with wrong credentials (error message)
- [ ] Protected route redirect to login
- [ ] Session persistence (refresh page)
- [ ] GitHub OAuth flow (if configured)
- [ ] Token refresh on 401 response
- [ ] Logout clears session
- [ ] Profile menu display
- [ ] Multi-tab sync (localStorage events)
- [ ] Auto-logout on token expiry

## Browser DevTools Debugging

### Check Auth State
```javascript
// In browser console
localStorage.getItem('momentum-token')
localStorage.getItem('momentum-refresh-token')
```

### Decode JWT Token
```javascript
function decodeJWT(token) {
  const [, payload] = token.split('.')
  return JSON.parse(atob(payload))
}
decodeJWT(localStorage.getItem('momentum-token'))
```

### Monitor Network
1. Open DevTools → Network
2. Filter: `auth`
3. Watch requests to:
   - `/auth/register`
   - `/auth/login`
   - `/auth/refresh`
   - `/auth/logout`
   - `/auth/me`

## Known Limitations

- GitHub OAuth connection on Settings page needs backend endpoint
- Profile editing not implemented (view-only)
- Email verification not implemented
- Password reset not implemented
- Two-factor authentication not implemented

## Next Steps

1. **Manual Testing** - Run full test flow above
2. **GitHub OAuth** - Test OAuth callback if GitHub app is configured
3. **Error Scenarios** - Test invalid credentials, network errors
4. **Token Refresh** - Monitor token refresh in DevTools Network tab
5. **Session Persistence** - Test with browser restart

## Troubleshooting

**"Invalid URL" errors in frontend**
- Check VITE_API_BASE_URL in .env.local
- Ensure backend is running on configured port

**GitHub OAuth not working**
- Verify GITHUB_REDIRECT_URI in backend env
- Check GitHub app OAuth settings
- Clear browser cache and localStorage

**Session not persisting after refresh**
- Check localStorage isn't disabled
- Verify tokens are stored correctly
- Check browser console for errors

**Token refresh not working**
- Monitor Network tab for /auth/refresh calls
- Check token expiry times in JWT payload
- Verify refresh token is stored

---

**For detailed testing instructions, see FRONTEND_AUTH_TESTING.md**
