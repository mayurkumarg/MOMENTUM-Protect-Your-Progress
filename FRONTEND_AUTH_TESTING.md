# Frontend Authentication System - Testing Guide

## Overview
Complete frontend authentication system for Momentum with email/password login, GitHub OAuth, and session management.

## Prerequisites
- Backend running on `http://localhost:5000`
- Frontend running on `http://localhost:5173`
- .env.local configured with backend URL

## Testing Scenarios

### 1. Email Registration

**Test Case: Valid Registration**
1. Go to `http://localhost:5173/register`
2. Fill form:
   - Email: `test@example.com`
   - Username: `testuser`
   - Password: `Test123!Secure`
   - Confirm Password: `Test123!Secure`
3. Click "Create Account"
4. ✅ Should redirect to `/overview` and show authenticated state

**Test Case: Password Validation**
1. Go to `http://localhost:5173/register`
2. Try password `weak` (too short)
   - ✅ Should show error: "Password must be at least 8 characters"
3. Try password `Nodigit!` (no number)
   - ✅ Should show error: "Password must contain at least one number"
4. Try password `noupppercase1!` (no uppercase)
   - ✅ Should show error: "Password must contain at least one uppercase letter"

**Test Case: Email Validation**
1. Go to `http://localhost:5173/register`
2. Try email `invalid-email`
   - ✅ Should show error: "Please enter a valid email address"
3. Try email without @ symbol
   - ✅ Should show error: "Please enter a valid email address"

**Test Case: Password Confirmation**
1. Go to `http://localhost:5173/register`
2. Password: `Test123!Secure`
3. Confirm Password: `Different123!Secure`
4. Click "Create Account"
   - ✅ Should show error: "Passwords do not match"

**Test Case: Duplicate Email**
1. Register with `duplicate@example.com`
2. Try to register again with same email
   - ✅ Should show error: "User with this email already exists"

**Test Case: Username Validation**
1. Try username `ab` (too short)
   - ✅ Should show error: "Username must be at least 3 characters"
2. Try username with special chars `user!@#`
   - ✅ Should show error: "Username can only contain letters, numbers, and underscores"

### 2. Email Login

**Test Case: Valid Login**
1. Go to `http://localhost:5173/login`
2. Email: `test@example.com`
3. Password: `Test123!Secure`
4. Click "Sign in with Email"
5. ✅ Should redirect to `/overview`
6. ✅ Profile menu should show username

**Test Case: Invalid Credentials**
1. Go to `http://localhost:5173/login`
2. Email: `nonexistent@example.com`
3. Password: `AnyPassword123!`
4. Click "Sign in with Email"
5. ✅ Should show error: "Invalid credentials"

**Test Case: Wrong Password**
1. Go to `http://localhost:5173/login`
2. Email: `test@example.com`
3. Password: `WrongPassword123!`
4. Click "Sign in with Email"
5. ✅ Should show error: "Invalid credentials"

**Test Case: Empty Fields**
1. Go to `http://localhost:5173/login`
2. Leave email or password empty
3. Click "Sign in with Email"
4. ✅ Should show validation errors

**Test Case: Show/Hide Password**
1. Go to `http://localhost:5173/login`
2. Type password in field
3. Click eye icon
4. ✅ Should toggle between showing and hiding password

### 3. GitHub OAuth Login

**Test Case: GitHub Login Flow**
1. Go to `http://localhost:5173/login`
2. Click "Continue with GitHub" button
3. ✅ Should redirect to GitHub login
4. Authorize the application
5. ✅ Should redirect to `/auth/github/callback`
6. ✅ Should redirect to `/overview`
7. ✅ Profile menu should show GitHub username and email

**Test Case: GitHub Registration**
1. Go to `http://localhost:5173/register`
2. Click "Continue with GitHub" button
3. ✅ Should follow same flow as GitHub login
4. ✅ Should redirect to `/overview` after authorization

**Test Case: Existing GitHub User**
1. Register with GitHub once
2. Logout
3. Login with GitHub again
4. ✅ Should authenticate same user
5. ✅ Should redirect to `/overview`

### 4. Protected Routes

**Test Case: Redirect to Login**
1. Logout from application
2. Try to access `http://localhost:5173/overview`
3. ✅ Should redirect to `/login`
4. ✅ Should preserve original URL in state

**Test Case: Login and Access Protected Route**
1. Go to `/login`
2. Login with valid credentials
3. ✅ Should redirect to `/overview`
4. ✅ Should show authenticated layout with profile menu

**Test Case: All Protected Routes**
Navigate to each protected route while logged in:
- ✅ `/overview` - Overview page
- ✅ `/tasks` - Tasks page
- ✅ `/activity` - Activity page
- ✅ `/timeline` - Timeline page
- ✅ `/analytics` - Analytics page
- ✅ `/assistant` - Assistant page
- ✅ `/settings` - Settings page

### 5. Token Management

**Test Case: Token Persistence**
1. Login with valid credentials
2. Close the browser tab
3. Reopen `http://localhost:5173`
4. ✅ Should show authenticated state
5. ✅ Should display profile menu with user info

**Test Case: Token Refresh** (requires 15m+ access token expiry)
1. Login with valid credentials
2. Wait for access token to expire (or manually trigger)
3. Make any API request
4. ✅ Should automatically refresh token
5. ✅ Should stay authenticated

**Test Case: Session Expiry**
1. Login with valid credentials
2. Open browser dev tools
3. Go to Application > Local Storage
4. Delete `momentum-token` and `momentum-refresh-token`
5. Try to access protected route
6. ✅ Should redirect to `/login`
7. ✅ Should show "Your session expired" message

**Test Case: Token Storage**
1. Login with valid credentials
2. Open browser dev tools
3. Go to Application > Local Storage
4. ✅ Should see `momentum-token` key
5. ✅ Should see `momentum-refresh-token` key
6. ✅ Tokens should be valid JWTs

### 6. Logout

**Test Case: Logout from Sidebar**
1. Login with valid credentials
2. Click profile section in sidebar
3. Click "Sign out" button
4. ✅ Should immediately redirect to `/login`
5. ✅ Tokens should be cleared from localStorage

**Test Case: Logout and Login Again**
1. Login with valid credentials
2. Logout
3. Login with different account
4. ✅ Should show new user's profile
5. ✅ Should have different tokens

### 7. Cross-Tab Session

**Test Case: Login in One Tab, Reflect in Another**
1. Open two tabs with `http://localhost:5173`
2. Login in first tab
3. ✅ Second tab should show authenticated state
4. Logout in first tab
5. ✅ Second tab should redirect to login

### 8. Loading States

**Test Case: Initial App Load**
1. Login and refresh page
2. ✅ Should show loading screen with "Checking your session"
3. ✅ Should redirect to app after auth check

**Test Case: Form Loading**
1. Go to `/login`
2. Click "Sign in with Email" button
3. ✅ Button should show loading state
4. ✅ Should disable button while loading

**Test Case: Profile Menu Loading**
1. Click profile menu button
2. Click "Sign out"
3. ✅ Should show loading state on sign out button

### 9. Error Handling

**Test Case: Network Error**
1. Disconnect internet
2. Try to login
3. ✅ Should show network error message
4. Reconnect internet
5. Try again
6. ✅ Should succeed

**Test Case: Server Error**
1. Stop backend server
2. Try to login
3. ✅ Should show error message: "Could not complete that request"
4. Start backend server
5. Try again
6. ✅ Should succeed

**Test Case: GitHub Error**
1. Go to `/login`
2. Click "Continue with GitHub"
3. Deny application access
4. ✅ Should redirect back with error
5. ✅ Should show error message

### 10. Profile Menu

**Test Case: Profile Display**
1. Login with valid credentials
2. ✅ Profile menu should show avatar with first 2 letters of username
3. ✅ Should show full username
4. ✅ Should show email address

**Test Case: Profile Menu Navigation**
1. Click profile menu dropdown
2. ✅ Should show "Profile Settings" option
3. ✅ Should show "Sign out" option
4. Click "Profile Settings"
5. ✅ Should navigate to `/settings`

**Test Case: Close Profile Menu on Clicking Outside**
1. Click profile menu to open
2. ✅ Should show dropdown
3. Click outside the menu
4. ✅ Menu should close

## Browser Compatibility

Test on:
- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Performance Checks

- ✅ Login should complete in < 2 seconds
- ✅ Registration should complete in < 2 seconds
- ✅ Token refresh should be seamless (< 1 second)
- ✅ Protected route access should be instant (< 500ms)

## Security Checklist

- ✅ Passwords never logged or exposed in URLs
- ✅ Tokens stored in localStorage (not in cookies)
- ✅ API calls include Authorization header with Bearer token
- ✅ No credentials stored in URL parameters (except GitHub callback)
- ✅ CORS headers properly configured
- ✅ API errors don't expose sensitive information

## Quick Test Summary

**Minimal Happy Path (2 minutes)**
1. Register new account with email/password
2. Verify redirected to `/overview`
3. Verify profile menu shows username
4. Click logout
5. Verify redirected to `/login`
6. Login with same email/password
7. Verify authenticated and back at `/overview`

**GitHub OAuth Path (1 minute)**
1. Click "Continue with GitHub" on login
2. Authorize app on GitHub
3. Verify redirected to `/overview`
4. Verify profile shows GitHub username
5. Logout and verify

## Debugging Tips

**Check localStorage:**
```javascript
// In browser console
localStorage.getItem('momentum-token')
localStorage.getItem('momentum-refresh-token')
```

**Decode JWT token:**
```javascript
// In browser console
function decodeJWT(token) {
  const [, payload] = token.split('.')
  return JSON.parse(atob(payload))
}
decodeJWT(localStorage.getItem('momentum-token'))
```

**Monitor API requests:**
1. Open DevTools > Network tab
2. Filter to `auth/` endpoints
3. Monitor request/response for:
   - `/auth/login` - email login
   - `/auth/register` - registration
   - `/auth/refresh` - token refresh
   - `/auth/logout` - logout
   - `/auth/me` - current user
   - `/auth/github` - GitHub OAuth

**Monitor auth state:**
```javascript
// In browser console
// Set custom handler to see auth state changes
window.addEventListener('storage', (e) => {
  if (e.key === 'momentum-token') {
    console.log('Token changed:', e.newValue ? 'set' : 'cleared')
  }
})
```

## Environment Variables

Ensure `.env.local` has:
```
VITE_API_BASE_URL=http://localhost:5000/api
```

Backend should have:
```
FRONTEND_URL=http://localhost:5173
GITHUB_REDIRECT_URI=http://localhost:5000/api/auth/github/callback
```
