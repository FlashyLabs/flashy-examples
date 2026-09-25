⚡ **Example 8: Error Recovery**

> Handle common errors: insufficient balance, revoked grants, routing failures, and implement retry logic.

## Error Types

| Error | When It Happens | Recovery |
|-------|---|---|
| **Insufficient Balance** | Transfer amount > available balance | Reduce amount or wait for deposit |
| **Revoked Grant** | Grant revoked before execution | Request new grant |
| **Declined Introduction** | Hop declines routing request | Choose alternative path |
| **Invalid Consent Token** | Token expired or already used | Get new consent token |
| **Network Failure** | Temporary connection issue | Retry with exponential backoff |

## Key Patterns

### 1. Graceful Error Handling

```javascript
try {
  const result = rails.execute(draft, token);
} catch (err) {
  if (err.message.includes('insufficient balance')) {
    // Request smaller transfer
  } else if (err.message.includes('revoked')) {
    // Get new grant
  }
}
```

### 2. Retry with Exponential Backoff

```javascript
async function executeWithRetry(draft, token, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return rails.execute(draft, token);
    } catch (err) {
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt - 1) * 100;
        await sleep(backoff);
      } else {
        throw err;
      }
    }
  }
}
```

### 3. Path Fallback

```javascript
const paths = router.findPaths(from, to);
for (const path of paths) {
  if (router.isPathViable(path)) {
    return path;  // Use first viable path
  }
}
```

## Test Coverage

- Insufficient balance (error message)
- Revoked grant (immediate effect)
- Retry logic (transient failures)

---

**Read next:** Example 9 (Attenuation Chains).
