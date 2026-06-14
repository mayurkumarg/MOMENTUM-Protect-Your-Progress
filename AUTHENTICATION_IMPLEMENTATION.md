# Momentum Authentication System - Implementation Guide

## Overview

The authentication system has been completely redesigned to support multiple auth methods while preserving existing GitHub OAuth functionality. The system now supports:

✅ Email + Password Registration & Login  
✅ GitHub OAuth Login  
✅ JWT Access Tokens (15m expiry)  
✅ Refresh Tokens (30d expiry)  
✅ Secure Password Hashing (bcrypt)  
✅ Token Management  
✅ Multi-Provider User Support  

---

## Architecture

### Database Schema (User Model)

```javascript
{
  // Auth Provider
  authProvider: 'github' | 'email',
  
  // Email + Password Auth
  email: string (unique, lowercase),
  password: string (hashed with bcrypt, select: false),
  
  // GitHub OAuth
  githubId: string (unique, sparse),
  
  // Profile
  username: string (unique),
  avatar: string,
  
  // Token Management
  refreshTokens: [{
    token: string,
    expiresAt: date,
    createdAt: date
  }],
  
  // Status
  isEmailVerified: boolean,
  role: 'user' | 'admin',
  
  // Metadata
  createdAt: date,
  updatedAt: date
}
```

### Authentication Flow

#### Email + Password Login
```
User → POST /api/auth/register → Validate Input → Hash Password → Create User
User → POST /api/auth/login → Validate Input → Compare Password → Generate Tokens
```

#### GitHub OAuth Login
```
User → GET /api/auth/github → Redirect to GitHub
GitHub → Callback with Code → GET /api/auth/github/callback
Backend → Exchange Code for Token → Fetch User Data → Find/Create User → Redirect with Tokens
```

#### Token Refresh
```
User → POST /api/auth/refresh → Validate Refresh Token → Generate New Access Token
```

---

## API Endpoints

### 1. Registration
**POST** `/api/auth/register`

Request:
```json
{
  "email": "user@example.com",
  "username": "john_doe",
  "password": "SecurePass123",
  "confirmPassword": "SecurePass123"
}
```

Response (201):
```json
{
  "success": true,
  "data": {
    "message": "Registration successful",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "username": "john_doe",
      "email": "user@example.com",
      "authProvider": "email",
      "isEmailVerified": false
    }
  }
}
```

Validation Rules:
- Email: Valid email format, unique
- Username: 3-20 chars, alphanumeric + underscore, unique
- Password: Min 8 chars, 1 uppercase, 1 lowercase, 1 number

### 2. Login
**POST** `/api/auth/login`

Request:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "username": "john_doe",
      "email": "user@example.com",
      "authProvider": "email",
      "isEmailVerified": false
    }
  }
}
```

### 3. GitHub OAuth URL
**GET** `/api/auth/github?source=web&returnTo=/dashboard`

Query Parameters:
- `source` (optional): 'web' or 'extension' (default: 'extension')
- `returnTo` (optional): Path to redirect after auth (default: '/overview')

Returns: Redirect to GitHub authorization page

### 4. GitHub OAuth Callback
**GET** `/api/auth/github/callback?code=xxx&state=xxx`

Returns: Redirect with tokens in query params or extension redirect

### 5. Refresh Token
**POST** `/api/auth/refresh`

Request:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### 6. Get Current User
**GET** `/api/auth/me`

Headers:
```
Authorization: Bearer <access_token>
```

Response (200):
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "username": "john_doe",
    "email": "user@example.com",
    "authProvider": "email",
    "isEmailVerified": false
  }
}
```

### 7. Logout
**POST** `/api/auth/logout`

Headers:
```
Authorization: Bearer <access_token>
```

Response (200):
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

## Environment Variables

Add to `.env`:

```env
# JWT Configuration
JWT_SECRET=your_long_secret_key_min_32_chars_recommended_use_openssl_rand_base64_32
JWT_REFRESH_SECRET=another_long_secret_key_min_32_chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# GitHub OAuth (existing)
GITHUB_CLIENT_ID=your_github_app_client_id
GITHUB_CLIENT_SECRET=your_github_app_client_secret
GITHUB_REDIRECT_URI=http://localhost:5000/api/auth/github/callback

# Bcrypt Configuration
BCRYPT_ROUNDS=10
```

**Generate secure secrets:**
```bash
# macOS/Linux
openssl rand -base64 32
openssl rand -base64 32

# Windows (with OpenSSL installed)
openssl rand -base64 32
```

---

## Frontend Integration

### 1. Store Tokens
```javascript
import { storeToken, storeRefreshToken } from '@/api/client'

// After login
storeToken(response.data.token)
storeRefreshToken(response.data.refreshToken)
```

### 2. Use Tokens in Requests
The API client automatically attaches the token:

```javascript
import { apiRequest } from '@/api/client'

const data = await apiRequest('/tasks', { method: 'GET' })
```

### 3. Handle Token Expiry
```javascript
import { setUnauthorizedHandler } from '@/api/client'

setUnauthorizedHandler((error) => {
  if (error.status === 401) {
    // Redirect to login or refresh token
    window.location.href = '/login'
  }
})
```

### 4. Register User
```javascript
const response = await apiRequest('/auth/register', {
  method: 'POST',
  body: {
    email: 'user@example.com',
    username: 'john_doe',
    password: 'SecurePass123',
    confirmPassword: 'SecurePass123'
  },
  auth: false // No auth header needed for registration
})
```

### 5. Login User
```javascript
const response = await apiRequest('/auth/login', {
  method: 'POST',
  body: {
    email: 'user@example.com',
    password: 'SecurePass123'
  },
  auth: false
})

storeToken(response.token)
storeRefreshToken(response.refreshToken)
```

---

## Security Considerations

### Password Security
- ✅ Hashed with bcrypt (10 rounds)
- ✅ Never stored in plain text
- ✅ Never returned in API responses
- ✅ Validated before hashing

### JWT Security
- ✅ Short-lived access tokens (15m)
- ✅ Long-lived refresh tokens (30d) stored in DB
- ✅ Refresh tokens invalidated on logout
- ✅ Token type validation (no mixing refresh/access)

### Token Storage
- Store tokens in secure HttpOnly cookies (recommended production)
- Current: localStorage (suitable for SPA development)

### CORS Protection
- Frontend URL configured in `.env`
- Only authorized origins can make requests

---

## Migration Strategy for Existing Users

### Current State
Existing GitHub OAuth users have:
- `githubId` populated
- `username` set to GitHub login
- `email` populated from GitHub
- No password hash

### Migration Process

#### Automatic (On First Login)
When existing GitHub users login:
1. System finds user by `githubId`
2. Sets `authProvider` to 'github'
3. Generates new JWT tokens
4. Stores refresh token in DB

#### Manual Migration (Optional)
Users can link email + password:
```
User clicks "Add Email + Password Login"
→ Enters email + password
→ System updates existing user
→ Sets `authProvider` to both methods (future enhancement)
```

**No existing data is lost or modified.**

---

## Testing

### 1. Test Registration
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "Password123",
    "confirmPassword": "Password123"
  }'
```

### 2. Test Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123"
  }'
```

### 3. Test Protected Route
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer <your_token>"
```

### 4. Test Token Refresh
```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<your_refresh_token>"
  }'
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": "Valid email is required",
    "password": "Password must be at least 8 characters..."
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "Email already registered"
}
```

---

## File Structure

```
backend/
├── modules/
│   ├── auth/
│   │   ├── auth.controller.js       (NEW: Register, Login, Logout)
│   │   ├── auth.service.js          (NEW: Email/Password + GitHub)
│   │   ├── auth.validation.js       (NEW: Input validation)
│   │   ├── auth.routes.js           (UPDATED: New endpoints)
│   │   └── github.service.js        (Existing: GitHub OAuth)
│   └── user/
│       ├── user.model.js            (UPDATED: New fields)
│       └── user.service.js          (NEW: User operations)
├── middlewares/
│   └── authMiddleware.js            (UPDATED: New token structure)
└── .env                             (UPDATED: New secrets)
```

---

## What's Preserved

✅ GitHub OAuth flow  
✅ Extension OAuth support  
✅ Existing `/api/auth/github` endpoint  
✅ Existing `/api/auth/github/callback` endpoint  
✅ All existing users  
✅ Backward compatibility  

---

## Future Enhancements

1. **Email Verification**
   - Send verification email on registration
   - Endpoint to verify email token

2. **Password Reset**
   - Forgot password endpoint
   - Reset token system

3. **Social Login**
   - Google OAuth
   - Microsoft OAuth

4. **Role-Based Access**
   - User roles in schema
   - Role-based middleware

5. **Multi-Factor Authentication**
   - TOTP support
   - SMS verification

6. **Rate Limiting**
   - Auth endpoint rate limiting
   - Brute force protection

---

## Support

For issues or questions:
1. Check error messages in API responses
2. Review environment variables
3. Check server logs
4. Verify MongoDB connection
5. Ensure JWT secrets are set correctly

