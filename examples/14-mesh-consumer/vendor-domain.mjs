// The same-domain rule, stated once.
//
// CANONICAL COPY: `vendor-domain.mjs` in the agent-dns repository. It travels
// by byte-identical copy into every repository that has to decide whether two
// hosts belong to one publisher — agent-wellknown, bastion and flashy-examples
// today — and a drift test in each compares the copy against this file.
// Re-vendor; never edit a copy.
//
// The rule: `host` is the same domain as `domain` when it IS `domain` or is a
// subdomain of it. Case-insensitive; one trailing dot is ignored. This is
// deliberately narrower than "same registrable domain": without a Public
// Suffix List a resolver cannot tell `co.uk` from `example.com`, and every
// "last two labels" slice this file replaced guessed wrong on exactly that —
// `acme.co.uk` and `other.co.uk` shared a suffix and read as one publisher.
// A parent or a sibling host is refused; a publisher can always publish under
// the domain it names. Refusing to guess is the rule, not a limitation of it.
//
// No imports at all — not even `node:` — so it runs in a pure module, a
// browser and a shell alike.

/** Lowercase, trimmed, one trailing dot removed. `null` for a non-string. */
export function normalizeDomain(input) {
  if (typeof input !== 'string') return null;
  let d = input.trim().toLowerCase();
  if (d.endsWith('.')) d = d.slice(0, -1);
  return d;
}

/**
 * True when `host` is `domain` itself or a subdomain of it.
 *
 *   isSameDomain('api.example.com', 'example.com')   → true
 *   isSameDomain('example.com', 'api.example.com')   → false  (a parent)
 *   isSameDomain('b.example.com', 'a.example.com')   → false  (a sibling)
 *   isSameDomain('other.co.uk', 'acme.co.uk')        → false  (no suffix guess)
 */
export function isSameDomain(host, domain) {
  const h = normalizeDomain(host);
  const d = normalizeDomain(domain);
  if (!h || !d) return false;
  return h === d || h.endsWith(`.${d}`);
}

/**
 * True when both URLs parse, both are https, and `toUrl`'s host is the same
 * domain as `fromUrl`'s host under `isSameDomain`. The shape a consumer needs
 * before following a redirect: anything that fails is not followed.
 */
export function sameDomainUrl(fromUrl, toUrl) {
  let from;
  let to;
  try {
    from = new URL(fromUrl);
    to = new URL(toUrl);
  } catch {
    return false;
  }
  if (from.protocol !== 'https:' || to.protocol !== 'https:') return false;
  return isSameDomain(to.hostname, from.hostname);
}
