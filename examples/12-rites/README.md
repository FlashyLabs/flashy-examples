# Example 12: Rites — the `ritual/1` present tense

A faithful, dependency-free model of `ritual/1`, the estate's *present tense*:
the recurring, witnessed, consequence-bearing act. A subject publishes
**liturgies** (recurring rites on a cadence) and records **observances** against
them, each climbing a state ladder **by transition, never by assertion**.

```
performed  →  witnessed  →  consecrated        (or  void)
```

> Canonical spec: [`Rites-Network/SPEC.md`](https://github.com/FlashyLabs/Rites-Network/blob/main/SPEC.md).
> Guide: [rites-witnessed-observances.md](https://github.com/flashylabs/flashy-docs/blob/main/docs/guides/rites-witnessed-observances.md).

## The four refusals

1. **Agents observe; humans consecrate.** `performer` is an `agent/` id;
   `consecration.by` is a `person/` id and nothing else.
2. **Standing comes from what others assert.** A witness may be **neither the
   performer nor its principal** — self-witness throws.
3. **No money, no amounts, no scores — ever.** Accrual is a separate `reward/1`
   whose `basis` is the observance's evidence URL. An amount field is refused.
4. **The log is append-only.** A correction is a new `void` observance whose
   `supersedes` names the old one. Nothing is edited or deleted.

Every transition returns a **new** fragment and re-validates the whole thing.

## The shape

```json
{
  "contract": "ritual/1",
  "subject": "org/ritualos",
  "generated": "2026-09-26T06:00:00Z",
  "liturgies": [
    { "id": "daily-office", "title": "The Daily Office", "cadence": "daily",
      "rite": ["refresh the fragment", "seal the log"],
      "published_by": "person/michael", "since": "2026-09-01T00:00:00Z" }
  ],
  "observances": [
    { "id": "obs-1", "liturgy": "daily-office", "performer": "agent/ritualos-ci",
      "for": "org/ritualos", "at": "2026-09-26T04:00:00Z",
      "recorded": "2026-09-26T04:00:05Z",
      "evidence": "https://github.com/FlashyLabs/ritualos/actions/runs/9001",
      "state": "witnessed",
      "witness": { "by": "org/gda-capital",
                   "basis": "https://gda.group/.well-known/dir.json",
                   "at": "2026-09-26T05:00:00Z" } }
  ]
}
```

## The API (climb by transition)

| Function | Does | Refuses |
| --- | --- | --- |
| `createFragment({subject})` | A fresh calendar | non-org/person subject |
| `publishLiturgy(f, l)` | Adds a recurring rite | cadence off the closed list; empty rite; non-person `published_by` |
| `observe(f, o)` | The only door in — arrives `performed` | any asserted `state`/`witness`/`consecration`; non-agent performer; missing https evidence |
| `witness(f, id, {by, basis, at})` | `performed → witnessed` | self-witness (performer or principal); non-https basis |
| `consecrate(f, id, {by, at})` | `witnessed → consecrated` | non-`person/` `by`; unwitnessed observance |
| `voidObservance(f, id, {…})` | Appends a correcting `void` | superseding nothing real |
| `metrics(f)` | `{performed, witnessed, consecrated}` together | — |
| `project(f)` | Public projection + anti-metric note | — |

## Running

```bash
node examples/12-rites/index.mjs
npm test examples/12-rites      # 28 test cases
```

## What the tests prove

✅ The ladder is climbed by transition — an asserted `state` is refused  
✅ Self-witness is refused (performer and principal)  
✅ Consecration requires a `person/` and a witnessed observance  
✅ Every money/amount/score field is refused  
✅ Append-only: a `void` supersedes; the original is never edited  
✅ Immutability: each transition returns a new fragment  
✅ `metrics` ship the witnessed/consecrated share **with** the raw count (the anti-metric)  
✅ `project` keeps evidence URLs and carries the consequence note  

## Why the anti-metric matters

Raw observance volume is the number a faucet inflates. `metrics()` always ships
`witnessed` and `consecrated` beside `performed`, and `project()` carries a note
a renderer may not drop, so a surface cannot show the flattering digit alone. A
summary that stripped the evidence URLs would be that rule run backwards.

## The Flashy Estate standards

| Standard | Format | Tense | Solves |
| --- | --- | --- | --- |
| Trust Routing | `trust/1` | — | Consent paths through graphs (Magician) |
| Federated Roadmaps | `intent/1` | future | Roadmap visibility without logins (IntentMesh) |
| Witnessed Practice | `ritual/1` | present | Legible, witnessed practice (Rites) |
| Governance | `aao/0.1` | — | Machine-readable authority (FlashyOS) |

## Next steps

1. Read the [rites guide](https://github.com/flashylabs/flashy-docs/blob/main/docs/guides/rites-witnessed-observances.md) for the full doctrine
2. Note how reward is kept out (`reward/1`) and why
3. See `WELL_KNOWN` — a subject serves its fragment whole at `/.well-known/ritual.json`
