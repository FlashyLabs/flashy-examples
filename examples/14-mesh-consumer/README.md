# Example 14: Mesh reference consumer

The consumer side of the estate standards: read `intent/1` and `ritual/1`
fragments from many sources and fold them into one machine-readable report —
the shape a real scheduled "observe" job takes.

The network read is **injected** as a `fetcher`, so the fold is pure and every
path is tested without egress (the same discipline that keeps the Attendant's
`handleUpdate` pure).

## The four findings — never collapsed

A source read is one of four states, and conflating them is the estate's most
expensive habit:

| State | Means | Why distinct |
| --- | --- | --- |
| `ok` | 200 + a valid fragment | Carries the fragment |
| `absent` | 404 | The publisher exists and published nothing here |
| `unreachable` | fetch threw / null / non-200 | A fact about *our* connectivity |
| `invalid` | not https, not JSON, unknown contract, redirect off the domain or to http | Served something, but not a fragment |

## Null is never zero

If **every** ritual source is unreachable, the ritual summary is `null` — never
`{performed: 0}`. A zero would be a claim about the network; `null` is the truth
about this process. The report's `note` says so in words.

```javascript
const report = await consume(fetcher, urls);
report.ritual;  // { performed, witnessed, consecrated }  OR  null
```

## The rules it enforces

- **https only.** A non-https URL is `invalid`.
- **One redirect, to the same domain or a subdomain of it.** `acme.com →
  www.acme.com` is the same publisher; `acme.com → other.com` is `invalid` — a
  redirect must not let one domain borrow another's record. The rule is
  `sameDomainUrl` in `vendor-domain.mjs`: both URLs https, and the target's
  host is the source's host or a subdomain of it. A parent (`www.acme.com →
  acme.com`) and a sibling are refused too. It is deliberately **not** "same
  registrable domain": an earlier version of this example sliced the last two
  labels of each hostname, which reads `acme.co.uk` and `other.co.uk` as one
  publisher — without a Public Suffix List nothing can tell `co.uk` from
  `example.com`, so the rule refuses to guess.
- **`vendor-domain.mjs` is a copy, not a source.** It is byte-identical to
  `vendor-domain.mjs` in the `agent-dns` repository, where the rule is
  canonical, and is vendored likewise into `agent-wellknown` and `bastion` so
  every consumer and every checker in the estate answers "same domain" the
  same way. Re-vendor from `agent-dns`; never edit the copy here.
- **The anti-metric survives the fold.** Ritual metrics carry `witnessed` and
  `consecrated` beside the raw `performed`, always.
- **Never throws.** Every source failure is a finding in the report, not an
  exception that aborts the batch.

## The API

| Function | Does |
| --- | --- |
| `readSource(fetcher, url)` | One source → `{ url, state, contract?, fragment? }` |
| `mergeIntents(fragments)` | Dedup intent items by id; flag duplicates |
| `summarizeRituals(fragments)` | Sum ritual metrics with the raw count, or `null` |
| `consume(fetcher, urls)` | Read all, route by contract, fold into one report |
| `memoryFetcher(map)` | An in-memory fetcher for demos and tests |
| `sameDomainUrl(from, to)` (from `vendor-domain.mjs`) | The same-domain rule: both https, `to`'s host is `from`'s host or a subdomain of it |

## Running

```bash
node examples/14-mesh-consumer/index.mjs
npm test examples/14-mesh-consumer   # 18 test cases
```

## Where this goes next

In production, `fetcher` is a real https client with a timeout and a response
size cap, and `consume` runs on a schedule (a `delivery/1`-style workflow),
failing the run on a regression. This example is the pure core that such a job
wraps — the same split the estate uses everywhere: a pure fold, an injected read.

## The Flashy Estate standards

| Standard | Format | This example reads |
| --- | --- | --- |
| Federated Roadmaps | `intent/1` | ✅ merges + dedups |
| Witnessed Practice | `ritual/1` | ✅ summarizes (anti-metric intact) |
| Trust Routing | `trust/1` | — (see Example 03) |
| Governance | `aao/0.1` | — (see Example 13) |
