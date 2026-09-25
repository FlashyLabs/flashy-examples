# flashy-examples — Teaching Repository

Working examples and tutorials for Flashy packages. This is not a product library; it's a learning resource built to teach patterns and invariants.

## Rules

**Examples are teaching material, not reference implementations.**
- Each example demonstrates ONE clear pattern
- Code prioritizes clarity over performance
- Comments explain "why", not "what"
- Tests verify invariants, not implementation details

**All examples must be runnable:**
- `npm test` passes
- `npm run lint` passes
- Every example has a README
- Every example has working code AND test suite

**Never commit broken examples:**
- If a package version doesn't work, update the dependency
- If a test fails, fix it before pushing
- If documentation drifts from code, update the docs

## House Rules — True in Every Repository in the Flashy Estate

**`main` is not necessarily the default branch.** Ask, every time:
```bash
git symbolic-ref --short refs/remotes/origin/HEAD
```

**Say which branch you measured.** Reading the working tree tells you about your checkout, not the repository.

**No secret in a file, a repo, or an artifact.** Secret Manager only. A committed credential is burned the moment it lands and stays burned after deletion.

**The licence is declared once**, in `tools/estate-licences.mjs` in flashyos. Do not decide this repository's licence inside it. Client work is never open-licensed.

**A generated file is regenerated, never hand-edited.** `shiplog.fragment.json`, `backlog.fragment.json`, built outputs are regenerated.

**Report what happened, including when it is worse than expected.** A number somebody assumed is worth less than a number somebody measured.

## Learning Path

1. **Start with Example 1 (Ledger Basics)** to understand append-only settlement
2. **Move to Example 2 (Rails Consent)** to understand the approval gate
3. **Learn Example 3 (Magician)** to understand trust graphs and routing
4. **Study Example 4 (FlashyID)** to understand identity and delegation
5. **Complete Example 5 (Combined)** to wire it all together

Each example is standalone but builds on concepts from earlier ones.

## Adding a New Example

1. Create `examples/0X-your-example/`
2. Add `index.mjs` with working code
3. Add `index.test.mjs` with full test coverage
4. Add `README.md` explaining the pattern
5. Update root README.md with description
6. Run `npm test` — all tests pass
7. Run `npm run lint` — no lint errors
8. Commit with clear message

## Testing

```bash
npm test                          # Run all tests
npm test examples/01-ledger-basics # Run one example's tests
```

Tests should verify:
- ✅ Happy path
- ✅ Error conditions
- ✅ Invariant preservation
- ✅ Idempotency
- ✅ Cross-system integration

## Contributing

Submit examples via pull request to this repository. Before opening:

1. All tests pass: `npm test`
2. All lint passes: `npm run lint`
3. README is clear and complete
4. Code is readable and simple
5. Invariants are tested, not implementation details

No half-finished examples. No "TODO" comments. No skipped tests.
