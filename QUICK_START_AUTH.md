# Quick Start - Authentication System

## Setup

### 1. Generate JWT Secrets
```bash
# macOS/Linux
openssl rand -base64 32
openssl rand -base64 32

# Windows (PowerShell)
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

### 2. Update .env
```env
JWT_SECRET=<paste_first_secret>
JWT_REFRESH_SECRET=<paste_second_secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
BCRYPT_ROUNDS=10

# Keep existing GitHub OAuth config
GITHUB_CLIENT_ID=your_id
GITHUB_CLIENT_SECRET=your_secret
GITHUB_REDIRECT_URI=http://localhost:5000/api/auth/github/callback
```

### 3. Start Backend
```bash
npm run dev
```

---

## API Examples

### Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "username",
    "password": "Password123",
    "confirmPassword": "Password123"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Registration successful",
    "user": { "id": "...", "username": "username", "email": "user@example.com" }
  }
}
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": { "id": "...", "username": "username" }
  }
}
```

### Get Current User (Protected)
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer <access_token>"
```

### Refresh Token
```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{ "refreshToken": "<refresh_token>" }'
```

### Logout (Protected)
```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer <access_token>"
```

### GitHub OAuth
```bash
# Redirect user to:
http://localhost:5000/api/auth/github?source=web&returnTo=/dashboard
```

---

## Frontend Integration

### Login Component
```javascript
import { apiRequest, storeToken, storeRefreshToken } from '@/api/client'

const handleLogin = async (email, password) => {
  try {
    const result = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false
    })
    
    storeToken(result.token)
    storeRefreshToken(result.refreshToken)
    
    // Redirect to dashboard
    window.location.href = '/dashboard'
  } catch (error) {
    console.error('Login failed:', error.message)
  }
}
```

### Register Component
```javascript
const handleRegister = async (email, username, password, confirmPassword) => {
  try {
    await apiRequest('/auth/register', {
      method: 'POST',
      body: { email, username, password, confirmPassword },
      auth: false
    })
    
    // Show success message and redirect to login
    window.location.href = '/login'
  } catch (error) {
    console.error('Registration failed:', error.message)
  }
}
```

### Protected Route Wrapper
```javascript
import { useEffect, useState } from 'react'
import { getStoredToken } from '@/api/client'

export const ProtectedRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    const token = getStoredToken()
    if (token) {
      setIsAuthenticated(true)
    } else {
      window.location.href = '/login'
    }
    setIsLoading(false)
  }, [])
  
  if (isLoading) return <div>Loading...</div>
  return isAuthenticated ? children : null
}
```

### Check Token Expiry
```javascript
const checkTokenExpiry = () => {
  const token = getStoredToken()
  if (!token) return false
  
  try {
    const decoded = JSON.parse(atob(token.split('.')[1]))
    return decoded.exp * 1000 > Date.now()
  } catch {
    return false
  }
}
```

---

## Key Changes from Previous System

| Feature | Before | After |
|---------|--------|-------|
| Password Auth | ❌ No | ✅ Yes |
| Email Signup | ❌ No | ✅ Yes |
| Password Hashing | ❌ No | ✅ bcrypt |
| Access Token Expiry | 7d | ✅ 15m |
| Refresh Token Expiry | 30d | ✅ 30d |
| Multiple Auth Methods | ❌ No | ✅ Yes |
| Token Validation | Basic | ✅ Enhanced |
| GitHub OAuth | ✅ Yes | ✅ Yes (preserved) |

---

## Troubleshooting

### "Invalid JWT Secret"
- Ensure `JWT_SECRET` and `JWT_REFRESH_SECRET` are set
- Use strong secrets (min 32 chars)
- Restart server after changing

### "Email already registered"
- User already signed up with this email
- Use different email or login with existing account

### "Username already taken"
- Choose different username

### "Invalid or expired token"
- Token has expired, use refresh endpoint
- Or ask user to login again

### "Missing authorization header"
- Include `Authorization: Bearer <token>` header
- Check token value is not empty

---

## Database Migration (For Existing Users)

Existing GitHub OAuth users will automatically:
1. Get new `authProvider` field set to "github"
2. Keep their existing data intact
3. Work with new token system immediately
4. No action needed

To add email+password login to existing GitHub user:
```bash
# User can reset password and login with email
# (Email reset endpoint planned for v2)
```

---

## Next Steps

1. Test registration and login flows
2. Integrate with frontend components
3. Test token refresh
4. Set up password reset (v2)
5. Add email verification (v2)

---

For full documentation, see: `AUTHENTICATION_IMPLEMENTATION.md`
