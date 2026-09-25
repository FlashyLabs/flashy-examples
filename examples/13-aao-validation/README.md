# Example 13: AAO Charter Validation

Learn to validate organization charters against the AAO (Authority, Activation, Outcomes) standard.

## What is AAO?

AAO is the governance standard for the Flashy estate. Every property (organization) publishes a charter that declares:

- **Authority** — who can make decisions
- **Activation** — who can activate/enable features
- **Outcomes** — who sees the results/outputs

The charter is validated against strict rules to ensure it's machine-readable, consistent, and safe.

## Key Concepts

### Charter — organization's governance declaration

```javascript
{
  kind: 'flashyos/1',                  // AAO version
  name: 'Example Organization',
  accountableTo: 'person/ceo',
  roles: [
    {
      id: 'role/admin',
      name: 'Administrator',
      authority: ['can:read', 'can:write', 'can:delete'],
      members: ['person/alice']
    },
    {
      id: 'role/viewer',
      name: 'Viewer',
      authority: ['can:read'],
      members: ['person/bob', 'person/charlie']
    }
  ],
  capabilities: [
    {
      id: 'cap/admin',
      role: 'role/admin',
      action: 'can:write'
    }
  ]
}
```

### Three Validation Rules

1. **Authority is explicit** — every capability names who can do it
2. **Roles are closed** — members are listed, not open-ended
3. **Outcomes are visible** — what the org produces is published

## Running This Example

```bash
npm run examples:aao-validation
npm test examples/13-aao-validation
```

## Code Walkthrough

See `index.mjs` for the full example. Key patterns:

```javascript
import { validateCharter, validateRole, listCapabilities } from './index.mjs';

// 1. Create a charter
const charter = {
  kind: 'flashyos/1',
  name: 'ACME Corp',
  accountableTo: 'person/alice',
  roles: [
    {
      id: 'role/admin',
      name: 'Admin',
      authority: ['can:read', 'can:write'],
      members: ['person/alice']
    }
  ]
};

// 2. Validate the charter
const result = validateCharter(charter);
console.log(result.valid);    // true or false
console.log(result.errors);   // array of error messages

// 3. Validate individual roles
const role = charter.roles[0];
const roleValid = validateRole(role);
console.log(roleValid.valid);

// 4. List all capabilities in charter
const capabilities = listCapabilities(charter);
console.log(capabilities);
```

## Invariants Tested

✅ **Charter has required fields** — kind, name, accountableTo  
✅ **All roles are valid** — id, name, authority, members required  
✅ **Authority is closed** — member list is exhaustive  
✅ **Capabilities reference real roles** — no dangling references  
✅ **IDs are globally unique** — no duplicate role or capability IDs  

## Why This Matters

**Problem:** Decentralized organizations need a standard way to declare who can do what. Without it, every property invents its own governance model.

**Solution:** AAO charter means:
- Authority is machine-readable and can be verified
- Roles and capabilities are explicitly named
- No hidden or implicit permissions
- Different organizations can interoperate because they speak the same language

## The Flashy Estate Standards

This example teaches the `aao/1` format, the governance standard for all properties:

- `trust/1` — trust graphs and routing (Magician)
- `intent/1` — federated roadmaps (IntentMesh)
- `ritual/1` — witnessed observances (Rites)
- `aao/1` — authority, activation, outcomes (GDA-OS)

## The 10 House Rules

Every property in the Flashy estate follows 10 invariants (see flashy-examples README):

1. **Only Minor amounts** — no floating point arithmetic
2. **Explicit consent required** — approval before value moves
3. **Attenuation only** — delegated grants narrow, never widen
4. **Sealed outcomes** — verifiable cryptographic proof
5. **Opaque identity** — balances keyed by ID, never name
6. **Verified claims** — numbers are measured, not assumed
7. **Clarity over cleverness** — code is readable
8. **No secrets** — everything goes to Secret Manager
9. **Immutable audit trail** — all history is append-only
10. **Immediate revocation** — permissions can be withdrawn instantly

## Next Steps

1. Validate your own organization charter against AAO
2. Publish your charter at `/.well-known/flashyos.json`
3. Use the conformance checker to verify adoption
4. Join the Flashy Network by registering your capabilities

