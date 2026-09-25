# Contributing to Flashy Examples

This repository is a teaching resource. Every contribution should make Flashy packages easier to understand and use.

## Before You Start

1. **Pick an example pattern to teach.** Each example should be:
   - Standalone (runnable on its own)
   - Complete (demonstrates full pattern, not partial)
   - Clear (prioritizes readability)
   - Tested (comprehensive test suite)

2. **Check existing examples.** Don't duplicate—build on them or suggest improvements.

3. **Read the pattern's documentation first.**
   - For ledger: read `@flashylabs/ledger` README
   - For rails: read `@flashylabs/rails` README
   - For magician: read `@magician-network/core` README
   - For flashyid: read `@flashyid/sdk` README

## Writing an Example

### Structure

```
examples/0X-your-pattern/
├── index.mjs              # Working code (100-150 lines)
├── index.test.mjs         # Full test suite
└── README.md              # Learning guide
```

### Code

```javascript
/**
 * Example N: Your Pattern Name
 *
 * One sentence explaining what this teaches.
 * Demonstrates: key invariants, patterns, concepts.
 */

async function main() {
  console.log('=== Your Pattern ===\n');
  
  // Keep it simple: no error handling, happy path only
  // Tests cover error cases
  
  console.log('=== Example Complete ===\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
```

### Tests

```javascript
import { test } from 'node:test';
import assert from 'node:assert';

test('Pattern: description of what succeeds', async (t) => {
  // Arrange
  const thing = setup();
  
  // Act
  const result = await thing.doSomething();
  
  // Assert
  assert.equal(result, expected);
});

test('Pattern: error case', async (t) => {
  const thing = setup();
  
  await assert.rejects(
    () => thing.doInvalidThing(),
    /expected error message/i
  );
});
```

### README

Structure:

```markdown
# Example N: Your Pattern Name

## What Problem Does This Solve?

One paragraph explaining the real-world need.

## Key Concepts

Define terms your example uses.

## Running This Example

```bash
npm run examples:your-pattern
npm test examples/0X-your-pattern
```

## Code Walkthrough

Walk through the main flow step-by-step.

## Invariants Tested

List what the tests verify.

## Next Steps

What should they learn after this?
```

## Checklist

Before opening a pull request:

- [ ] Code runs: `node examples/0X-*/index.mjs`
- [ ] Tests pass: `npm test examples/0X-*`
- [ ] Lint passes: `npm run lint`
- [ ] README is clear and complete
- [ ] No TODO or FIXME comments
- [ ] No skipped tests (`.skip`, `.only`)
- [ ] Code is under 200 lines (keep it simple)
- [ ] Comments explain "why", not "what"
- [ ] Examples follow house rules (never hardcode amounts, always use Minor, etc.)
- [ ] Added to root README.md with description

## Principles

**Clarity over cleverness.** Readable code teaches better than clever code.

**Happy path first.** The example shows the normal case. Tests cover edge cases.

**No error handling in examples.** Let errors bubble. Tests verify error cases.

**Comments are sparse.** Well-named variables and functions don't need explanation. Comments explain non-obvious invariants and constraints.

**Tests verify invariants.** Not implementation details. Test the "what must be true", not "how the code works".

## Questions?

Check existing examples first—they're all teaching material too. If something is unclear in the docs, that's a documentation bug. Open an issue.

---

**Remember:** Examples are the first thing people read. Make them count.
