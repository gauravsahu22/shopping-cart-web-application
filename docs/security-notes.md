# Security notes

The threat model for a public, unauthenticated storefront that talks to a
third-party API and persists data in the browser. Two sources of input are
treated as untrusted: **the API response** and **anything read back from
`localStorage`**.

---

## Dependency audit

Run on 2026-09-18 with npm 11.6.2 against the committed lockfile:

```bash
npm audit
```

```
found 0 vulnerabilities
```

```
dependencies: 5 prod, 683 dev, 123 optional, 31 peer (694 total)
severity:     0 critical, 0 high, 0 moderate, 0 low, 0 info
```

Nothing was found, so nothing was fixed or accepted. The result reflects the
lockfile as committed; it is re-run in CI on every push so a newly disclosed
advisory surfaces on the next build rather than at the next manual check.

**One non-vulnerability finding, recorded because it is a real maintenance
signal:** `npm install` prints
`npm warn deprecated eslint@9.39.5: This version is no longer supported`.
This is an end-of-support notice for a development-only linter, not a
vulnerability. It is accepted for now: ESLint 10 is not yet supported by
`angular-eslint@21`, which peers on `^8.57.0 || ^9.0.0 || ^10.0.0` but is only
tested against 9 in this configuration. Upgrading before the Angular tooling
does would risk a broken lint step for no security benefit.

**The runtime dependency surface is deliberately small** — 10 direct runtime
dependencies, all first-party framework packages: six `@angular/*`, `@ngrx/store`,
`@ngrx/effects`, `rxjs` and `tslib`. (`@ngrx/entity` and `@ngrx/operators` were
installed early and removed once it was clear nothing imported them; npm reports
5 resolved production packages because the Angular and NgRx packages share
transitive dependencies.) No date library, no UI kit, no icon
package (icons are a vetted inline path table), no HTTP wrapper. Every added
dependency is code that ships to the customer and has to be trusted and patched.

---

## Cross-site scripting

**No `innerHTML`, no `bypassSecurityTrust*`, no `DomSanitizer` anywhere in the
codebase.** Every piece of API text — product titles, descriptions, categories —
is rendered through Angular interpolation, which escapes it. This is verifiable:

```bash
grep -rn "innerHTML\|bypassSecurityTrust\|DomSanitizer" src/   # no matches
```

The icon component was written specifically to avoid the usual shortcut. Icons
are looked up by a typed `IconName` in a hard-coded path table and rendered as
`<path [attr.d]="...">`, so there is no code path where a string from outside
the application becomes markup.

### URL injection

An `<img src>` bound from an API field is an injection point: `javascript:` and
`data:` URLs are both attack vectors in some contexts. `parseProduct` resolves
every image URL through the `URL` constructor and accepts only `http:` and
`https:`; anything else becomes an empty string and the card renders its
placeholder. The same check is applied again to persisted cart items, since
those are written by the browser and can be edited by hand.

Tested in `product.parser.spec.ts` and `cart.persistence.spec.ts`.

---

## `localStorage` tampering

The cart is persisted under `kibo.cart.v1`. Anything on the origin — the user
with devtools open, or a script that got in some other way — can replace it with
arbitrary JSON. Deserialising that straight into the store would mean a hostile
value reaching a template, a price, or a total.

`parseCartState` therefore validates field by field and never throws:

| Input                           | Result                            |
| ------------------------------- | --------------------------------- |
| Malformed JSON                  | Empty cart                        |
| Not an object / no `items`      | Empty cart                        |
| An item missing `price`/`title` | That item dropped, the rest kept  |
| `quantity: 999999`              | Clamped to 99                     |
| `quantity: -4`                  | Clamped to 1                      |
| `image: "javascript:…"`         | Image blanked, item kept          |
| Duplicate product ids           | Later duplicates dropped          |
| Strings of unbounded length     | Truncated (2,000 chars for title) |

The clamps matter beyond tidiness: an unbounded quantity is an arithmetic
denial-of-service against the totals, and a duplicated id breaks the
one-line-per-product invariant the reducer depends on.

The storage key is versioned (`.v1`) so a future shape change can be ignored
wholesale instead of half-migrated.

There is also an end-to-end test (`ignores a tampered saved cart instead of
breaking`) that writes a deliberately hostile payload into `localStorage` and
asserts the real application still renders.

---

## Sensitive data

- **No secrets in the repository or in environment files.** The only
  configuration value is the public API base URL, injected through
  `API_BASE_URL`. The Fake Store API needs no key. If it ever did, the key would
  belong on a server, because anything in an Angular build is readable by anyone
  who opens devtools.
- **No card details are collected.** The checkout form asks for name, email and
  a shipping address, and the payment section says in plain language that no
  card data is taken. Collecting card fields in a frontend-only demo would be
  actively harmful: it teaches the wrong pattern and invites someone to wire it
  to a real endpoint. Real payments belong behind a PCI-compliant provider's
  hosted fields or redirect, where the card number never touches this origin.
- **Customer details are never persisted.** The order (which carries name and
  email) lives in memory only. This is why refreshing `/order-completed`
  redirects home rather than restoring the confirmation: writing PII to
  `localStorage` for the convenience of surviving a refresh is a bad trade, and
  the data would then sit on a shared machine indefinitely. A real
  implementation fetches the order from the server by reference.
- **No authentication and no tokens**, so there is nothing to leak. If auth were
  added, the token would belong in an `HttpOnly; Secure; SameSite` cookie rather
  than in `localStorage`, precisely because of the XSS surface described above.
- **No analytics, no third-party scripts, no fonts from a CDN.** The only
  outbound requests are to the API and to the product image URLs it returns.

---

## Error handling and information disclosure

`toAppError` maps failures onto four user-facing categories with fixed messages.
Status codes, response bodies, stack traces and internal URLs never reach the
DOM — there is a test asserting that a 500 carrying
`https://internal.api.local/products?key=secret` and a stack trace produces a
message containing none of those strings.

Failures are surfaced as UI state (`status: 'error'`), not as uncaught
exceptions: every effect terminates its error branch with `catchError`, so a
failed request cannot produce an unhandled rejection in the console. The one
remaining console surface is `reportError` in `main.ts` if bootstrap itself
fails, which is a platform hook rather than a log line.

---

## Known gaps, stated rather than hidden

- **Client-side validation is a usability feature, not a security control.**
  The checkout form's rules stop typos; they stop nothing else. In a real system
  every field would be validated again server-side, and the order total would be
  recomputed from server-held prices rather than trusted from the client.
- **Prices come from the client at checkout.** `CheckoutActions.orderSubmitted`
  carries the basket and the total from the browser. With a real backend that
  payload would be a list of `(productId, quantity)` pairs and nothing else;
  pricing is the server's job. This is noted in the README's scaling section.
- **The order reference is generated client-side** using
  `crypto.getRandomValues`, which is the right primitive but the wrong place:
  uniqueness cannot be guaranteed by a client. It is a display string here, not
  an identifier anything trusts.
- **No Content-Security-Policy header is set**, because a static build has no
  server to set one. In production the host would send at least
  `default-src 'self'; img-src 'self' https:; connect-src 'self' https://fakestoreapi.com;
object-src 'none'; base-uri 'self'`, which is the control that would catch an
  XSS vector this review missed.
- **No Subresource Integrity**, as there are no third-party scripts to pin.
