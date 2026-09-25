# Example 4: FlashyID OAuth & Delegation

Learn identity, authentication, and the delegation pattern for fine-grained authorization.

## Why Delegation?

Traditional authorization grants all-or-nothing access: either you can do something or you can't.

Delegation is **attenuation**: a child grant is always narrower than its parent.

```javascript
// Parent grant: can spend up to $1000, expires in 1 year
const parent = { cap: 1000, expiry: yearFromNow };

// Child grant: can spend only $50, expires in 1 month
const child = attenuate(parent, {
  cap: 50,      // ✅ Narrower
  expiry: monthFromNow  // ✅ Earlier
});

// ❌ Cannot do this:
attenuate(parent, { cap: 2000 }); // ERROR: widening
```

## OAuth 2.1 / OIDC Flow

FlashyID uses standard OAuth for authentication:

```
1. User clicks "Login with FlashyID"
2. Browser redirects to https://id.flashyid.com/authorize
3. User enters credentials
4. FlashyID redirects back with authorization code
5. App exchanges code for ID token (JWT)
6. App verifies token signature with FlashyID's public key
```

## Delegation Grants

After auth, you can mint attenuated grants:

```javascript
// Full grant: can do anything the user authorized
const fullGrant = mintGrant(user, { cap: fullAuthority });

// Attenuate for a specific use case
const delegatedGrant = attenuate(fullGrant, {
  cap: limited_authority,
  expiry: sooner
});

// Pass delegated grant to untrusted code
// Even if that code is compromised, damage is bounded
```

## Key Constraints

**Attenuation, not inheritance:**
```javascript
// ✅ Correct
attenuate(grant, { cap: lessPermissive, expiry: sooner });

// ❌ Wrong
attenuate(grant, { cap: morePermissive }); // Throws
```

**Revocation is immediate:**
```javascript
revoke(grant);
// Any operation using this grant immediately fails
```

**Delegation chain is audited:**
```javascript
// Each attenuation is logged
// Can trace authority back to original grant
chain = grant.delegationChain();
// [{ action: 'mint', by: 'user', at: ... },
//  { action: 'attenuate', by: 'app1', at: ... },
//  { action: 'attenuate', by: 'app2', at: ... }]
```

## Running This Example

```bash
npm run examples:flashyid
npm test examples/04-flashyid-oauth
```

## Code Walkthrough

```javascript
// 1. Start OAuth flow
const { authUrl } = initOAuthFlow({
  redirectUri: 'https://app.example.com/callback',
  scope: ['openid', 'profile', 'email']
});

// User clicks link, authenticates...

// 2. Exchange code for token
const { idToken, accessToken } = await exchangeCode(code);

// 3. Verify token signature
const user = verifyIdToken(idToken, flashyidPublicKey);

// 4. Mint grant for user
const grant = mintGrant(user.sub, {
  cap: fullAuthority,
  expiry: Date.now() + 365 * 24 * 60 * 60 * 1000
});

// 5. Attenuate for specific purpose
const limitedGrant = attenuate(grant, {
  cap: limited_authority,
  expiry: Date.now() + 24 * 60 * 60 * 1000
});

// 6. Use in operation
const result = executeWithGrant(operation, limitedGrant);
```

## Invariants Tested

✅ **Token signature verifies** — cannot forge  
✅ **Attenuation narrows scope** — never widens  
✅ **Revocation is immediate** — any operation fails  
✅ **Delegation is auditable** — full chain recorded  
✅ **Expiry is enforced** — expired grants refuse operations  
✅ **Subject binding** — grant is tied to specific user  

## Next Steps

Once comfortable with identity and delegation:
1. Move to Example 5 to wire it all together
2. Build a production auth flow
3. Implement attenuated access control policies
