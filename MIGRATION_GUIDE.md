# Migration Guide - New Authentication System

## Overview

The new authentication system is **100% backward compatible**. All existing users continue to work without any changes.

## Existing Users - What Happens?

### Current State (Before Migration)
- Users authenticated via GitHub OAuth
- Single `githubId` field
- Single `refreshToken` field
- No password support

### After Migration (Automatic)

#### First Login with GitHub OAuth
1. System finds user by `githubId`
2. Automatically sets `authProvider` to "github"
3. Migrates refresh token to new storage format
4. Generates new JWT tokens
5. User experiences no disruption

**User data in database:**
```javascript
{
  githubId: "12345",
  username: "github_user",
  email: "user@github.com",
  authProvider: "github",           // NEW: Set automatically
  refreshTokens: [{                 // CHANGED: Now an array
    token: "...",
    expiresAt: "2024-12-31",
    createdAt: "2024-06-14"
  }],
  isEmailVerified: true,            // NEW: Set to true for GitHub
  password: null,                   // NEW: No password for GitHub users
  avatar: "https://..."
}
```

## Migration Steps

### Step 1: Deploy Backend Changes
```bash
# On production server
git pull origin main
npm install bcrypt
npm start
```

### Step 2: Update Environment Variables
```env
# Add new secrets (generate with: openssl rand -base64 32)
JWT_SECRET=your_new_secret_key
JWT_REFRESH_SECRET=your_new_refresh_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
BCRYPT_ROUNDS=10

# Keep existing GitHub OAuth config
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_REDIRECT_URI=...
```

### Step 3: Database Migration (Automatic)
The migration happens automatically on first user login:
- Old `refreshToken` field is read (if exists)
- New `refreshTokens` array is created
- `authProvider` is set
- User continues to work

**No manual database migration needed!**

### Step 4: Deploy Frontend Changes
```bash
# Update API client to use new endpoint structure
git pull origin main
npm install
npm run dev
```

## Rollback Plan (If Needed)

### Option 1: Keep Old System Running
The old token system works alongside new:
- Old tokens continue to validate
- Old `authMiddleware` still accepts old JWT format
- No breaking changes

### Option 2: Database Rollback
If you need to revert:
```bash
# Backup current database
mongodump --db momentum_tasks

# Revert to old system
git revert <commit-hash>
npm start
```

All user data is preserved - no data loss occurs.

## User Actions Required

### For Existing GitHub OAuth Users
✅ **No action required**
- Login as usual with GitHub
- System automatically migrates on next login

### For New Email + Password Users
Users can now:
1. Sign up with email + password
2. Set up account in one step
3. No external service required

### For Users Wanting to Add Email Login
**Planned Feature (v2):**
- Email verification endpoint
- Password reset endpoint
- Account linking (GitHub + Email)

## Testing Migration

### Test 1: Existing GitHub User Login
```bash
1. Open: http://localhost:5000/api/auth/github?source=web
2. Authorize with GitHub
3. Check user in database has authProvider: "github"
4. Check refreshTokens array has one entry
```

### Test 2: New Email Registration
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "username": "newuser",
    "password": "Password123",
    "confirmPassword": "Password123"
  }'
```

### Test 3: Email Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "Password123"
  }'
```

### Test 4: Protected Route
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer <token>"
```

## Database Schema Changes

### New Fields Added
```javascript
{
  authProvider: {
    type: String,
    enum: ['github', 'email'],
    required: true,
    default: 'email'
  },
  
  password: {
    type: String,
    select: false  // Never returned in responses
  },
  
  refreshTokens: [{
    token: String,
    expiresAt: Date,
    createdAt: { type: Date, default: Date.now }
  }],
  
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  }
}
```

### Deprecated Fields
- ❌ `refreshToken` (single string)
  - Replaced by `refreshTokens` array
  - Old field ignored if present
  - Can be safely removed later

## Performance Impact

✅ **Minimal Impact**
- Password hashing: ~100-200ms per registration (acceptable)
- Token generation: Same as before
- Database queries: Similar performance
- Memory usage: Minimal increase

## Security Improvements

✅ **Bcrypt Password Hashing** - Industry standard
✅ **Shorter Access Token Expiry** - 15m instead of 7d
✅ **Refresh Token Rotation** - Optional (v2)
✅ **Token Validation** - Enhanced type checking
✅ **Password Requirements** - Enforced validation

## Monitoring After Migration

### Check these metrics:
1. **Login Success Rate** - Should remain >95%
2. **Token Refresh Rate** - Track new refreshes
3. **Error Logs** - Monitor for 401/403 errors
4. **Database Size** - Should grow ~10-15% due to token array

### Warning Signs:
- ❌ High 401 errors
- ❌ Users unable to login
- ❌ Rapid database growth
- ❌ Slow token generation

## Rollback Checklist

If you need to rollback:
- [ ] Database backup created
- [ ] Old system tested locally
- [ ] Frontend using old API format
- [ ] All users notified
- [ ] Production deployment plan

## FAQ

### Q: Will my existing users be affected?
**A:** No, they continue to work seamlessly with automatic migration.

### Q: Do I need to update user passwords?
**A:** No, GitHub OAuth users don't have passwords. Email users can set them on signup.

### Q: Can users have both GitHub and email login?
**A:** Future feature (v2). Currently one auth method per user.

### Q: What if someone registered with email that matches GitHub email?
**A:** They're treated as separate accounts (can link later in v2).

### Q: Is my data safe?
**A:** Yes, no user data is deleted or modified. Only new fields are added.

### Q: How long does migration take?
**A:** Instantaneous per user on their first login. No downtime needed.

### Q: Can I revert if something goes wrong?
**A:** Yes, just deploy old code. Users remain unaffected.

## Timeline

### Immediate (This Release)
- Email + Password auth
- GitHub OAuth integration
- JWT + Refresh tokens
- Protected routes

### Phase 2 (v2)
- Email verification
- Password reset
- Account linking
- Social login

### Phase 3 (v3)
- Multi-factor authentication
- Role-based access control
- API key authentication
- Rate limiting

## Support

For migration issues:
1. Check error logs
2. Review environment variables
3. Test single user login flow
4. Contact support with error details

---

**Your data is safe. Migration is automatic. No downtime required.**
