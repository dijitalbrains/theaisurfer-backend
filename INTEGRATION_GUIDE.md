# SSO Integration Guide

## Overview

This guide explains how to integrate child projects with the parent authentication platform using Single Sign-On (SSO). The SSO system allows child projects to authenticate users through the parent platform without managing their own authentication system.

## Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│                 │         │                 │         │                 │
│  Child Project  │────────▶│  Parent Auth    │────────▶│   Child Project │
│  (Remixer)      │         │   Platform      │         │   (Remixer)     │
│                 │         │                 │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
     Initiates SSO            User Authenticates          Receives Tokens
```

## Flow Diagram

1. **User visits child project** → Child detects no/expired token
2. **Child redirects to parent** → `GET https://auth.theaisurfer.com/auth/sso?project=remixer&apiKey=...&returnUrl=...`
3. **Parent validates credentials** → Checks API key and return URL
4. **User authenticates** → Login/Register or use existing session
5. **User confirms access** → "Continue to Remixer?"
6. **Parent generates tokens** → JWT access + refresh tokens
7. **Parent redirects back** → `https://remixer.com/callback?token=...&refresh=...&user=...`
8. **Child stores tokens** → Save to localStorage/cookies
9. **Child validates token** → Call `/auth/validate` endpoint
10. **User is authenticated** → Show protected content

## Prerequisites

Before integrating, you need:

1. **Project registered** in parent platform
2. **API Key** generated for your project
3. **Redirect URLs** whitelisted in project settings

Contact the platform administrator to set up your project.

## Step-by-Step Integration

### 1. Detect Token Status

Check if the user has a valid token in your child project:

```javascript
// utils/auth.js
export function getToken() {
  return localStorage.getItem('authToken');
}

export function isTokenExpired(token) {
  if (!token) return true;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= payload.exp * 1000;
  } catch (error) {
    return true;
  }
}

export function needsAuthentication() {
  const token = getToken();
  return !token || isTokenExpired(token);
}
```

### 2. Initiate SSO Flow

When authentication is needed, redirect to the parent platform:

```javascript
// utils/sso.js
const SSO_BASE_URL = 'https://auth.theaisurfer.com/auth/sso';
const PROJECT_SLUG = 'remixer';
const API_KEY = process.env.PARENT_API_KEY; // Store securely in backend!

export function initiateSSOAuth() {
  // Generate CSRF token
  const state = generateRandomString(32);
  sessionStorage.setItem('sso_state', state);
  
  // Build SSO URL
  const ssoUrl = new URL(SSO_BASE_URL);
  ssoUrl.searchParams.set('project', PROJECT_SLUG);
  ssoUrl.searchParams.set('apiKey', API_KEY);
  ssoUrl.searchParams.set('returnUrl', window.location.origin + '/auth/callback');
  ssoUrl.searchParams.set('state', state);
  
  // Redirect to parent platform
  window.location.href = ssoUrl.toString();
}

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
```

**Important:** Never expose the API key in frontend code! The example above should be implemented in a backend API endpoint:

```javascript
// Backend API endpoint
app.get('/api/auth/sso-url', (req, res) => {
  const state = generateRandomString(32);
  const ssoUrl = new URL('https://auth.theaisurfer.com/auth/sso');
  ssoUrl.searchParams.set('project', 'remixer');
  ssoUrl.searchParams.set('apiKey', process.env.PARENT_API_KEY);
  ssoUrl.searchParams.set('returnUrl', process.env.CALLBACK_URL);
  ssoUrl.searchParams.set('state', state);
  
  res.json({ url: ssoUrl.toString(), state });
});
```

### 3. Handle Callback

Create a callback route to receive tokens from the parent platform:

```javascript
// pages/AuthCallback.jsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  useEffect(() => {
    handleAuthCallback();
  }, []);
  
  async function handleAuthCallback() {
    // Extract parameters
    const token = searchParams.get('token');
    const refresh = searchParams.get('refresh');
    const user = searchParams.get('user');
    const state = searchParams.get('state');
    
    // Validate state parameter (CSRF protection)
    const savedState = sessionStorage.getItem('sso_state');
    if (state !== savedState) {
      console.error('Invalid state parameter');
      navigate('/login');
      return;
    }
    
    // Validate token with parent platform
    const isValid = await validateToken(token);
    if (!isValid) {
      console.error('Invalid token');
      navigate('/login');
      return;
    }
    
    // Store tokens
    localStorage.setItem('authToken', token);
    localStorage.setItem('refreshToken', refresh);
    localStorage.setItem('user', user);
    
    // Clean up
    sessionStorage.removeItem('sso_state');
    
    // Redirect to app
    navigate('/dashboard');
  }
  
  return <div>Authenticating...</div>;
}
```

### 4. Validate Token

Always validate the token with the parent platform:

```javascript
// utils/api.js
export async function validateToken(token) {
  try {
    const response = await fetch(
      `https://auth.theaisurfer.com/auth/validate?token=${token}`
    );
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.valid === true;
  } catch (error) {
    console.error('Token validation failed:', error);
    return false;
  }
}
```

### 5. Token Refresh

Implement token refresh before the access token expires:

```javascript
// utils/auth.js
export async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  
  try {
    const response = await fetch('https://auth.theaisurfer.com/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });
    
    if (!response.ok) {
      throw new Error('Token refresh failed');
    }
    
    const data = await response.json();
    
    // Update stored tokens
    localStorage.setItem('authToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    
    return data.accessToken;
  } catch (error) {
    // Refresh failed, need to re-authenticate
    localStorage.clear();
    initiateSSOAuth();
    throw error;
  }
}
```

### 6. Axios Interceptor (Recommended)

Automatically handle token refresh and authentication:

```javascript
// api/axios.js
import axios from 'axios';
import { refreshAccessToken, needsAuthentication, initiateSSOAuth } from '../utils/auth';

const api = axios.create({
  baseURL: process.env.API_BASE_URL,
});

// Request interceptor - add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If 401 and haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try to refresh token
        const newToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to SSO
        initiateSSOAuth();
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
```

## API Reference

### GET /auth/sso

Initiates SSO authentication flow.

**Query Parameters:**
- `project` (string, required) - Project slug
- `apiKey` (string, required) - Project API key
- `returnUrl` (string, required) - Callback URL (must be whitelisted)
- `state` (string, optional) - CSRF protection token

**Response:**
```json
{
  "sessionId": "a1b2c3d4e5f6...",
  "message": "SSO session created successfully"
}
```

### GET /auth/sso/session

Get SSO session data (used by frontend).

**Query Parameters:**
- `id` (string, required) - Session ID

**Response:**
```json
{
  "projectSlug": "remixer",
  "projectName": "Remixer",
  "returnUrl": "https://remixer.theaisurfer.com/auth/callback",
  "state": "csrf_token"
}
```

### POST /auth/sso/complete

Complete SSO authentication (called after user confirms).

**Headers:**
- `Authorization: Bearer <access_token>`

**Body:**
```json
{
  "sessionId": "a1b2c3d4e5f6..."
}
```

**Response:**
```json
{
  "redirectUrl": "https://remixer.theaisurfer.com/callback?token=xxx&refresh=yyy&user=...",
  "tokens": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "state": "csrf_token"
  }
}
```

### GET /auth/validate

Validate an access token.

**Query Parameters:**
- `token` (string, required) - Access token to validate

**Response:**
```json
{
  "valid": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "projectSlug": "remixer"
  }
}
```

## Security Best Practices

### 1. API Key Storage
- **Never** expose API keys in frontend code
- Store API keys in environment variables
- Use backend-to-backend communication for sensitive operations

### 2. HTTPS Only
- Always use HTTPS in production
- Never send tokens over unencrypted connections

### 3. State Parameter
- Always use and validate the `state` parameter
- Prevents CSRF attacks
- Generate cryptographically random values

### 4. Token Storage
- Use `httpOnly` cookies when possible
- If using localStorage, be aware of XSS risks
- Never log tokens

### 5. Token Validation
- Always validate tokens with the parent platform
- Don't trust tokens without verification
- Implement token refresh before expiration

### 6. Return URL Validation
- Only use whitelisted return URLs
- Validate URLs on both client and server
- Prevent open redirect vulnerabilities

## Error Handling

### Common Errors

**401 Unauthorized - Invalid API Key**
```json
{
  "statusCode": 401,
  "message": "Invalid API key"
}
```
**Solution:** Verify your API key is correct

**400 Bad Request - Invalid Return URL**
```json
{
  "statusCode": 400,
  "message": "Return URL is not whitelisted"
}
```
**Solution:** Add the return URL to your project's allowed redirect URLs

**404 Not Found - Project Not Found**
```json
{
  "statusCode": 404,
  "message": "Project 'xyz' not found"
}
```
**Solution:** Verify the project slug is correct

**400 Bad Request - Expired Session**
```json
{
  "statusCode": 400,
  "message": "Invalid or expired SSO session"
}
```
**Solution:** SSO sessions expire after 15 minutes. Start the flow again.

## Testing

### Test SSO Flow

1. Clear all tokens from localStorage
2. Navigate to your app
3. Should redirect to parent platform
4. Login/Register
5. Confirm access to your project
6. Should redirect back with tokens
7. Verify user is authenticated

### Test Token Refresh

1. Wait for access token to expire (15 minutes)
2. Make an API call
3. Should automatically refresh token
4. Should succeed without re-authentication

### Test Token Validation

```bash
curl -X GET "https://auth.theaisurfer.com/auth/validate?token=YOUR_TOKEN"
```

## Support

For issues or questions:
- Check the Swagger documentation at `https://auth.theaisurfer.com/api/docs`
- Contact the platform administrator
- Review this integration guide

## Example Projects

See example implementations in:
- `/examples/react-integration` - React + Vite example
- `/examples/nextjs-integration` - Next.js example
- `/examples/vanilla-js-integration` - Vanilla JavaScript example
