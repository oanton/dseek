# API Rate Limits

## Overview

All API endpoints are subject to rate limiting to ensure fair usage.

## Default Limits

| Tier | Requests/min | Requests/day | Max Payload |
|------|-------------|--------------|-------------|
| Free | 60 | 1,000 | 1 MB |
| Pro | 600 | 50,000 | 10 MB |
| Enterprise | 6,000 | Unlimited | 100 MB |

## Endpoint-Specific Limits

### Search Endpoints
- `/api/search`: 100 requests/minute
- `/api/search/batch`: 10 requests/minute

### Upload Endpoints
- `/api/upload`: 20 requests/minute
- Maximum file size: 50 MB

## Rate Limit Headers

All responses include rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

## Exceeding Limits

When you exceed rate limits, you'll receive a `429 Too Many Requests` response.

### Retry Strategy

1. Check `Retry-After` header
2. Implement exponential backoff
3. Maximum retry attempts: 3

## Increasing Limits

Contact sales@example.com to discuss enterprise limits.
