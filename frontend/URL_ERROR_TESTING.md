# Testing the URL Error Fix

## Quick Start

### 1. Verify Environment Setup
```bash
# Check .env.local exists in frontend folder
cat frontend/.env.local
# Should output: VITE_API_BASE_URL=/api
```

### 2. Start Backend (if not running)
```bash
cd backend
npm start
# Backend should run on http://localhost:5000
```

### 3. Start Frontend Dev Server
```bash
cd frontend
npm run dev
# Frontend should run on http://localhost:5173
```

### 4. Open Browser Console
```
Press F12 → Console tab
Look for any errors (should be none now)
```

## Test Cases

### Test 1: Check URL Construction Works
**In Browser Console:**
```javascript
// Test that buildUrl works correctly
import { apiRequest } from './src/api/client.js'

// This should NOT throw error anymore
try {
  await apiRequest('/auth/me')
  console.log('✅ URL construction successful')
} catch (err) {
  console.log('❌ Error:', err.message)
}
```

### Test 2: Register New Account
1. Go to `http://localhost:5173/auth/register`
2. Fill in:
   - Name: "Test User"
   - Email: "test@example.com"
   - Password: "SecurePass123!"
   - Confirm: "SecurePass123!"
3. Click "Create Account"
4. **Expected:** 
   - No "Invalid URL" error
   - Either success message or validation error (both OK)

### Test 3: Login
1. Go to `http://localhost:5173/auth/login`
2. Fill in:
   - Email: "test@example.com"
   - Password: "SecurePass123!"
3. Click "Sign In"
4. **Expected:**
   - No "Invalid URL" error
   - Either logged in or "Invalid credentials" message (both OK)

### Test 4: GitHub OAuth
1. Go to `http://localhost:5173/auth/login`
2. Click "Sign in with GitHub"
3. **Expected:**
   - Redirects to GitHub login (not "Invalid URL" error)

### Test 5: Protected Routes
1. Without logging in, try to access `http://localhost:5173/overview`
2. **Expected:**
   - Redirects to login page (not "Invalid URL" error)

### Test 6: Session Restoration
1. Login successfully
2. Refresh page (F5)
3. **Expected:**
   - Stay logged in (session restored)
   - No console errors

## Expected Console Output (No Errors)
```
✓ No "Failed to construct 'URL': Invalid URL" errors
✓ No buildUrl() errors
✓ Possibly some CORS warnings (expected in dev)
✓ Successful requests to /api/auth/* endpoints
```

## Production Deployment

### Before Building
1. Update `.env` (or your CI/CD) with:
   ```
   VITE_API_BASE_URL=https://your-api.example.com/api
   ```

2. Build:
   ```bash
   npm run build
   ```

3. Deploy dist folder to your hosting

### Verify Production
1. Open deployed app
2. Browser console should show no errors
3. Try authentication flow (register/login)
4. All endpoints should work

## Troubleshooting

### Still Getting "Invalid URL" Error?
1. Check `frontend/.env.local` exists with `VITE_API_BASE_URL=/api`
2. Clear browser cache (Ctrl+Shift+Delete)
3. Restart dev server
4. Check browser console for specific error message

### Backend Not Responding?
1. Verify backend running: `curl http://localhost:5000/api/auth/me`
2. Should get 401 (Unauthorized) - that's OK
3. If connection refused, start backend server

### CORS Errors?
Backend CORS should allow localhost:5173:
```javascript
// In backend cors config
origin: ['http://localhost:5173', ...]
```

## Files to Verify
- ✅ `frontend/.env.local` - exists with VITE_API_BASE_URL
- ✅ `frontend/src/api/client.js` - buildUrl() is updated
- ✅ `frontend/src/api/auth.js` - uses apiRequest()
- ✅ `frontend/src/auth/AuthProvider.jsx` - no console errors on load

## Success Criteria
- ✅ No "Failed to construct 'URL': Invalid URL" error
- ✅ No buildUrl errors in console
- ✅ Register endpoint works
- ✅ Login endpoint works
- ✅ GitHub OAuth redirect works
- ✅ Protected routes redirect to login
- ✅ Session persists on page refresh
