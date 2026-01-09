# API Integration Guide

This guide explains how child applications (like Remixer, Northstar) should integrate with the theaisurfer authentication backend.

## Integration Flow

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Child App  │         │  theaisurfer API │         │   MySQL DB      │
│  (Remixer)  │         │                  │         │                 │
└──────┬──────┘         └────────┬─────────┘         └────────┬────────┘
       │                         │                            │
       │  1. User visits         │                            │
       │     without token       │                            │
       ├─────────────────────────┤                            │
       │                         │                            │
       │  2. Redirect to login   │                            │
       │  /auth/login?           │                            │
       │    project=remixer&     │                            │
       │    redirect=callback    │                            │
       ├────────────────────────>│                            │
       │                         │                            │
       │                         │  3. Validate credentials   │
       │                         │     & project access       │
       │                         ├──────────────────────────> │
       │                         │ <────────────────────────┤ │
       │                         │                            │
       │  4. Redirect with tokens│                            │
       │  callback?              │                            │
       │    accessToken=xxx&     │                            │
       │    refreshToken=yyy     │                            │
       │ <───────────────────────┤                            │
       │                         │                            │
       │  5. Store tokens        │                            │
       │     Make API calls      │                            │
       │                         │                            │
```

## Step-by-Step Integration

### Step 1: Check for Existing Token

When a user visits your child app, check if you have a valid access token stored (localStorage/sessionStorage/cookie).

```javascript
// In your child app (e.g., Remixer)
const accessToken = localStorage.getItem('accessToken');
const refreshToken = localStorage.getItem('refreshToken');

if (!accessToken) {
  // No token, redirect to parent login
  redirectToParentLogin();
}
```

### Step 2: Redirect to Parent Login

If no valid token exists, redirect the user to the parent authentication page:

```javascript
function redirectToParentLogin() {
  const parentAuthUrl = 'http://localhost:3000/auth/login';
  const projectSlug = 'remixer'; // Your app's slug
  const callbackUrl = encodeURIComponent('http://localhost:3001/callback');
  
  // Redirect to parent with project context
  window.location.href = `${parentAuthUrl}?project=${projectSlug}&redirect=${callbackUrl}`;
}
```

**Note:** In a real implementation, the parent would show a login UI, not just be an API endpoint.

### Step 3: Handle Login in Parent

The parent backend validates:
1. User credentials
2. User has access to the specified project
3. Redirect URL is whitelisted for the project

### Step 4: Handle Callback in Child App

Create a callback route in your child app to receive the tokens:

```javascript
// Route: /callback
// Example: http://localhost:3001/callback?accessToken=xxx&refreshToken=yyy

function handleCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const accessToken = urlParams.get('accessToken');
  const refreshToken = urlParams.get('refreshToken');
  
  if (accessToken && refreshToken) {
    // Store tokens
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    
    // Validate token with parent
    validateToken(accessToken).then(isValid => {
      if (isValid) {
        // Redirect to app home
        window.location.href = '/';
      }
    });
  }
}
```

### Step 5: Use Token for API Calls

Include the access token in all API requests:

```javascript
async function makeAuthenticatedRequest(url, options = {}) {
  const accessToken = localStorage.getItem('accessToken');
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (response.status === 401) {
    // Token expired, try to refresh
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry the request
      return makeAuthenticatedRequest(url, options);
    } else {
      // Refresh failed, redirect to login
      redirectToParentLogin();
    }
  }
  
  return response;
}
```

### Step 6: Refresh Token When Expired

Access tokens expire after 15 minutes. Use the refresh token to get a new one:

```javascript
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (!refreshToken) {
    return false;
  }
  
  try {
    const response = await fetch('http://localhost:3000/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Store new tokens
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      
      return true;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
  }
  
  return false;
}
```

### Step 7: Validate Token

Optionally validate the token with the parent:

```javascript
async function validateToken(token) {
  try {
    const response = await fetch(
      `http://localhost:3000/auth/validate?token=${token}`
    );
    
    if (response.ok) {
      const data = await response.json();
      return data.valid;
    }
  } catch (error) {
    console.error('Token validation failed:', error);
  }
  
  return false;
}
```

## Complete React Example

```jsx
// AuthProvider.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const PARENT_URL = 'http://localhost:3000';
  const PROJECT_SLUG = 'remixer';
  const CALLBACK_URL = `${window.location.origin}/callback`;
  
  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem('accessToken');
    if (token) {
      validateAndSetUser(token);
    } else {
      setLoading(false);
    }
  }, []);
  
  async function validateAndSetUser(token) {
    try {
      const response = await fetch(
        `${PARENT_URL}/auth/validate?token=${token}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        // Token invalid, clear it
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setLoading(false);
    }
  }
  
  function login() {
    const loginUrl = `${PARENT_URL}/auth/login?project=${PROJECT_SLUG}&redirect=${encodeURIComponent(CALLBACK_URL)}`;
    window.location.href = loginUrl;
  }
  
  function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    login();
  }
  
  async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('accessToken');
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (response.status === 401) {
      // Try to refresh
      const refreshed = await refreshToken();
      if (refreshed) {
        // Retry
        return fetchWithAuth(url, options);
      } else {
        // Refresh failed, login again
        login();
      }
    }
    
    return response;
  }
  
  async function refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;
    
    try {
      const response = await fetch(`${PARENT_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        return true;
      }
    } catch (error) {
      console.error('Refresh failed:', error);
    }
    
    return false;
  }
  
  return (
    <AuthContext.Provider value={{ user, loading, login, logout, fetchWithAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

```jsx
// CallbackPage.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function CallbackPage() {
  const navigate = useNavigate();
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('accessToken');
    const refreshToken = urlParams.get('refreshToken');
    
    if (accessToken && refreshToken) {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      navigate('/');
    } else {
      navigate('/login');
    }
  }, [navigate]);
  
  return <div>Loading...</div>;
}
```

```jsx
// ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  return children;
}
```

```jsx
// App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthProvider';
import { CallbackPage } from './CallbackPage';
import { ProtectedRoute } from './ProtectedRoute';
import { HomePage } from './HomePage';
import { LoginPage } from './LoginPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/callback" element={<CallbackPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

## API Endpoints Reference

### POST /auth/register

Register a new user.

**Request:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "expiresIn": 900,
  "tokenType": "bearer"
}
```

### POST /auth/login

Login with optional project context.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "password123",
  "projectSlug": "remixer",
  "redirectUrl": "http://localhost:3001/callback"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "expiresIn": 900,
  "tokenType": "bearer"
}
```

### POST /auth/refresh

Refresh access token.

**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "expiresIn": 900,
  "tokenType": "bearer"
}
```

### GET /auth/validate

Validate a token.

**Query Parameters:**
- `token` - The access token to validate

**Response:**
```json
{
  "valid": true,
  "user": {
    "id": "uuid",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "projectSlug": "remixer"
}
```

### GET /auth/me

Get current user info (requires Authorization header).

**Headers:**
```
Authorization: Bearer eyJhbGc...
```

**Response:**
```json
{
  "id": "uuid",
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "projectSlug": "remixer"
}
```

## Security Best Practices

1. **Always use HTTPS in production**
2. **Store tokens securely** - Consider using httpOnly cookies instead of localStorage
3. **Validate redirect URLs** - Only whitelist your own domains
4. **Implement CSRF protection** - If using cookies
5. **Set appropriate CORS policies** - Don't allow all origins in production
6. **Monitor for suspicious activity** - Track failed login attempts
7. **Rotate refresh tokens** - The system already does this automatically
8. **Use short-lived access tokens** - 15 minutes is reasonable

## Testing the Integration

### Using cURL

```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "password": "password123"
  }'

# Login with project
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "password123",
    "projectSlug": "remixer"
  }'

# Use the token
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Refresh token
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

### Using Postman

1. Import the API collection from Swagger
2. Set up environment variables for tokens
3. Test the complete flow

## Troubleshooting

### Issue: "Access to project denied"

**Cause:** User doesn't have access to the specified project.

**Solution:** Grant access via API:
```bash
POST /projects/remixer/users/{userId}/grant
```

### Issue: "Invalid redirect URL"

**Cause:** Redirect URL is not whitelisted for the project.

**Solution:** Update project's allowed redirect URLs:
```bash
PATCH /projects/remixer
{
  "allowedRedirectUrls": [
    "http://localhost:3001/callback",
    "https://remixer.theaisurfer.com/callback"
  ]
}
```

### Issue: "Token expired"

**Cause:** Access token has expired (15 minutes).

**Solution:** Use the refresh token to get a new access token.

### Issue: "Refresh token revoked"

**Cause:** Refresh token was used and rotated, or manually revoked.

**Solution:** User needs to login again.

## Next Steps

1. Implement the callback handler in your child app
2. Test the complete auth flow
3. Add error handling and loading states
4. Implement auto-refresh before token expiry
5. Add logout functionality
6. Consider implementing social login in the future
