# Example 4: FlashyID Assertions & Delegation

Signed assertions, verified without a secret, carrying delegation chains that
only ever narrow — with `@flashyid/sdk`.

## What the SDK is, and is not

**There is no OAuth client in `@flashyid/sdk`.** No `FlashyIDClient`, no
`initAuthFlow()`, no `exchangeCode()`. The browser redirect dance — PKCE,
authorization code, token endpoint — is the OIDC *provider's* job
(`id.flashyid.com`, an `oidc-provider` service in the flashyID repository). An
earlier revision of this example called those methods; they never existed, and
this README said so only after the audit.

What the SDK gives you is the two halves either side of that dance:

- **The relying-party surface** — `verifyAssertion` (is this genuinely from
  Flashy ID?) and `authorize` (does the delegation it carries permit *this*
  action?). It holds only the public JWKS and can never mint.
- **The issuer half** — `signAssertion`, the EdDSA JWS the issuer produces,
  exported so the round trip is the SDK's own test.
- **The grant kernel** — `issueRoot`, `attenuate`, `verifyChain`, `permits`.
  Pure functions over a delegation chain. Time is an argument (`nowSec`),
  never a clock.

This example runs the issuer and the relying party in one process so the loop
is visible. The private key still never reaches the verifying side.

## The chain

A grant is not a token; it is a **chain**, root-first. Link 0 is issued from
the accountable human (a charter's `accountableTo`); every link below is an
attenuation to a new holder, and no link may grant more than the one above.

```javascript
const root = issueRoot({
  rootHuman: 'alice@example.com', holder: 'org/demo-acme',
  scp: ['payment.draft', 'payment.execute', 'report.read'],
  res: ['ledger:demo-acme'],
  lim: { approval_at_or_above: 'HIGH', spend_max: 100_000 },   // minor units
  iat, exp, jti: 'root-1',
});

const chain = attenuate(root, {
  holder: agentSubject('demo-acme', 'payments'),               // 'agent:demo-acme/payments'
  scp: ['payment.draft', 'report.read'],                       // ⊆ parent
  lim: { approval_at_or_above: 'HIGH', spend_max: 5_000 },     // no looser than parent
  iat, exp: iat + 86_400, jti: 'agent-1',                      // capped at the parent's
});
```

**`attenuate` refuses by returning, not throwing.** A widening comes back as
`{ ok: false, code: 'chain_widened', at, detail }`. Scope, resource, spend
ceiling and the approval bar can each only tighten; dropping a required
approval bar is a widening. Expiry is the one field capped rather than refused:
a child asking to outlive its parent gets the parent's expiry.

## The assertion

```javascript
// issuer
const jws = await signAssertion({ privateKey, issuer, audience, subject: agent, delegation: chain });

// relying party — public key only; in production, the issuer's /.well-known/jwks.json
const assertion = await verifyAssertion(jws, { issuer, audience, getKey: publicKey });
// { sub, del, claims } — or null for a bad signature, wrong iss/aud, expiry: never a throw
```

## `authorize` — genuine, and permitted?

```javascript
const { result } = await authorize(jws, { scope: 'payment.draft', amount: 1_240 }, { issuer, audience, getKey, nowSec });
result.ok                 // true: the effective grant (holder, root, scp, lim, exp)
// or a refusal with a code from the published vocabulary:
//   out_of_mandate     scope/resource not granted, or amount over spend_max
//   approval_required  in mandate, but at/above the human-approval bar
//   revoked | expired | broken_chain | empty_chain | untrusted_root
```

The approval bar is enforced inside `permits`: a demand at or above the chain's
`approval_at_or_above` is refused with `approval_required`, never silently
allowed. The enforcement gate (`evaluateGrant`) is the one caller that can
route to a human, so it maps that refusal — and only that one — to `ESCALATE`;
everything else stays `DENY` with the kernel's code.

## Running this example

```bash
npm run examples:flashyid
npm test examples/04-flashyid-oauth
```

An Ed25519 keypair comes from `node:crypto`'s `generateKeyPairSync`; `jose`
(the SDK's one dependency) accepts the `KeyObject` directly.

## Invariants tested

- **Sign then verify round-trips** — `sub` and `del` come back exactly
- **Verification never throws** — wrong audience, wrong issuer, another key, a tampered payload, no token: all `null`
- **Attenuation only narrows** — scope, resource, ceiling, approval bar; refusal returned as `chain_widened` at the offending index
- **A child never outlives its parent** — expiry capped; effective expiry is the chain minimum
- **`authorize` refuses specifically** — `out_of_mandate`, `approval_required`, and `null` at the wrong audience
- **The gate** — `ESCALATE` for `approval_required`, `ALLOW` below the bar, `DENY` with the code otherwise
- **Leaf holder must be the subject** — an org presenting its agent's chain is `broken_chain`
- **Revocation walks down; expiry at `nowSec`** — root revoked refuses at link 0; the agent link expires while the root stands
- **No delegation, no authority** — `empty_chain`

## Next steps

1. Example 5 wires an assertion, an introduction and a consent-gated transfer together
2. Example 9 walks a four-link chain and its cascading revocation
