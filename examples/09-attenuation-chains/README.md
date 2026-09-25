⚡ **Example 9: Attenuation Chains**

> Delegation is attenuation. Each level narrower than the last. Alice → Bob → Carol → Dave.

## The Invariant

A child grant can **never widen** authority. Only narrow:
- Cap can only decrease (or stay same)
- Expiry can only get earlier (or stay same)
- Purpose can only narrow (or stay same)

## Pattern

```
Alice (root grant)
  ├── cap: $1,000
  ├── expiry: 1 year
  └─→ Bob (attenuated)
       ├── cap: $500 (narrower)
       ├── expiry: 30 days (earlier)
       └─→ Carol (attenuated further)
            ├── cap: $250
            ├── expiry: 7 days
            └─→ Dave (attenuated further)
                 ├── cap: $100
                 └── expiry: 1 day
```

## Key Properties

| Property | Behavior |
|----------|---|
| **Narrowing** | Cap decreases, expiry earlier, scope narrows |
| **Cascading** | Revoke parent → children invalid |
| **Verification** | Each grant verifies its parent chain |
| **Enforcement** | Every operation checks grant cap |

## Use Cases

- **Delegation chains:** Manager → team lead → engineer
- **Temporary access:** Grant access for specific duration
- **Principle of least privilege:** Each delegate gets only what they need
- **Revocation:** Revoke at any level to stop all children

---

**Read next:** Example 10 (Performance Patterns).
