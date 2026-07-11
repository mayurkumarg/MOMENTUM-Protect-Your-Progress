# Setup

## Backend environment variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Required | Notes |
|---|---|---|
| `PORT` | no | defaults to `5000` |
| `MONGO_URI` | **yes** | server refuses to start without it |
| `JWT_SECRET` | **yes** | signs access tokens |
| `JWT_REFRESH_SECRET` | no | falls back to `JWT_SECRET` if unset — set a separate one for real deployments |
| `JWT_EXPIRES_IN` | no | defaults to `15m` |
| `JWT_REFRESH_EXPIRES_IN` | no | defaults to `30d` |
| `GITHUB_CLIENT_ID` | **yes** | from your GitHub OAuth app |
| `GITHUB_CLIENT_SECRET` | **yes** | from your GitHub OAuth app |
| `GITHUB_REDIRECT_URI` | **yes** | `http://localhost:5000/api/auth/github/callback` locally |
| `CLIENT_URL` / `FRONTEND_URL` | no | used for CORS + web-login redirect; `localhost:5173` is always allowed regardless |
| `EXTENSION_ID` | no | only needed for the extension's own GitHub OAuth flow (`chrome.identity`); without it that specific flow fails, everything else works |

`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `GITHUB_REDIRECT_URI` are required at startup even if you don't plan to exercise GitHub login — the server validates them in `backend/config/env.js` before it will boot.

### Generating a JWT secret

```bash
# macOS/Linux
openssl rand -base64 32
```
```powershell
# Windows PowerShell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

## GitHub OAuth app

1. Register an app at https://github.com/settings/developers.
2. Authorization callback URL → your `GITHUB_REDIRECT_URI` (`http://localhost:5000/api/auth/github/callback` locally).
3. Scope requested by the backend: `user:email`.

The OAuth redirect branches on a `state` param: logins started from the web app (`source=web`) land back on `${CLIENT_URL}${returnTo}`; logins started from the extension (`source=extension`, the default) land on `https://${EXTENSION_ID}.chromiumapp.org/`.

## Frontend

`frontend/.env.local` sets `VITE_API_BASE_URL=/api` — requests go through Vite's dev proxy (`frontend/vite.config.js` forwards `/api` to `http://localhost:5000`), not a hardcoded absolute URL. Don't change this to an absolute URL unless you're also removing the proxy config.

```
cd frontend
npm install
npm run dev
```

## Password validation rules

Enforced both client- and server-side (`backend/modules/auth/auth.validation.js`):
- Email: standard `local@domain.tld` shape
- Username: 3–20 chars, alphanumeric + underscore
- Password: 8+ chars, at least one uppercase, one lowercase, one digit

## Extension

No build step for local dev — load `extension/` directly as an unpacked extension (`chrome://extensions` → Developer mode → Load unpacked). It defaults to `BACKEND_URL: http://localhost:5000` and `FRONTEND_URL: http://localhost:5173` (`extension/config/env.js`). To package a build with different URLs baked in, use `npm run build:ext` / `npm run build:ext:prod` from the repo root (see `scripts/build-extension.js`).
