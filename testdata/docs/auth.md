# Authentication Guide

## Overview

This document describes the authentication system for our API.

## API Keys

To access the API, you need an API key. Keys can be generated from the dashboard.

### Key Types

1. **Production Keys** - Use these for production environments
2. **Development Keys** - Use these for testing and development

### Rate Limits

- Production: 1000 requests per minute
- Development: 100 requests per minute

## OAuth 2.0

We support OAuth 2.0 for third-party integrations.

### Supported Flows

- Authorization Code Flow
- Client Credentials Flow
- Refresh Token Flow

### Token Expiration

- Access tokens expire after 1 hour
- Refresh tokens expire after 30 days

## Best Practices

1. Never expose API keys in client-side code
2. Rotate keys regularly (every 90 days recommended)
3. Use environment variables for key storage
4. Enable IP allowlisting for production keys
