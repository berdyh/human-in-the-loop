# Decision Extraction Spike — Report

For each case: hand-written ground truth on the left, extraction results from each strategy on the right. Eyeball recall and precision; this report does not auto-score.

**Decision-surface bucket = entries marked `specified_in_prompt: no`.** That's the bucket the actual product cares about.

## Summary

| Case | GT total | GT not-specified | naive total / not-spec | structured total / not-spec | adversarial total / not-spec |
|---|---|---|---|---|---|
| `01-login` | 17 | 17 | — | — | — |
| `02-debounce` | 11 | 11 | — | — | — |
| `03-retry` | 14 | 13 | — | — | — |

---

## `01-login` — express/typescript

### Prompt

> Add a POST /login endpoint that takes email and password from the request body, validates the user against the database, and returns a JWT on success.

### Code

```typescript
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from './db';

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }

  const user = await db.users.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );

  return res.json({ token });
});

export default router;
```

### Ground truth (17 decisions, 17 not specified)

| # | Title | Category | In prompt? |
|---|---|---|---|
| 1 | Library: bcrypt for password hashing | dependencies | no |
| 2 | Library: jsonwebtoken for JWT | dependencies | no |
| 3 | JWT expiry: 7 days | defaults | no |
| 4 | JWT payload includes userId AND email | defaults | no |
| 5 | JWT secret from process.env.JWT_SECRET with non-null assertion | defaults | no |
| 6 | Generic 'Invalid credentials' message used for missing fields too | error_handling | no |
| 7 | Status code split: 400 missing fields vs 401 auth failure | error_handling | no |
| 8 | Same generic message for missing-user and wrong-password | security | no |
| 9 | Timing-attack vulnerability: early return on missing user | security | no |
| 10 | No rate limiting / brute-force protection | security | no |
| 11 | No password length / complexity check | validation | no |
| 12 | Email not normalized | validation | no |
| 13 | No email format validation | validation | no |
| 14 | Success response shape: { token } only | ux | no |
| 15 | No logging of login attempts (success or failure) | edge_cases | no |
| 16 | No CSRF protection | security | no |
| 17 | Express Router pattern with default export | defaults | no |


### Extraction · `naive`

_No output found — run `bun run extract` first._

### Extraction · `structured`

_No output found — run `bun run extract` first._

### Extraction · `adversarial`

_No output found — run `bun run extract` first._

---

## `02-debounce` — react/typescript

### Prompt

> Write a useDebounced React hook that takes a value and returns a debounced version. Useful for search inputs where we don't want to fire on every keystroke.

### Code

```typescript
import { useState, useEffect } from 'react';

export function useDebounced<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

### Ground truth (11 decisions, 11 not specified)

| # | Title | Category | In prompt? |
|---|---|---|---|
| 1 | Default delay: 300ms | defaults | no |
| 2 | API shape: returns single value, not [value, isPending] | ux | no |
| 3 | Initial debounced value equals immediate value | defaults | no |
| 4 | Trailing edge only — no leading edge fire | algorithm | no |
| 5 | No max-wait / no flush | edge_cases | no |
| 6 | delay parameter in dependency array | edge_cases | no |
| 7 | Cleanup via clearTimeout on unmount and on every value change | edge_cases | no |
| 8 | setTimeout-based, not requestAnimationFrame | algorithm | no |
| 9 | No SSR consideration | edge_cases | no |
| 10 | Generic over T | defaults | no |
| 11 | Named function export, not default | defaults | no |


### Extraction · `naive`

_No output found — run `bun run extract` first._

### Extraction · `structured`

_No output found — run `bun run extract` first._

### Extraction · `adversarial`

_No output found — run `bun run extract` first._

---

## `03-retry` — node/typescript

### Prompt

> Write a retry helper. It takes an async function and retries it on failure with exponential backoff.

### Code

```typescript
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 100 } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
```

### Ground truth (14 decisions, 13 not specified)

| # | Title | Category | In prompt? |
|---|---|---|---|
| 1 | Default maxAttempts: 3 | defaults | no |
| 2 | Default baseDelayMs: 100 | defaults | no |
| 3 | Backoff formula: base * 2^attempt | algorithm | partial |
| 4 | No jitter | algorithm | no |
| 5 | No max delay cap | algorithm | no |
| 6 | Catches everything (no error type filter) | error_handling | no |
| 7 | No retry predicate | error_handling | no |
| 8 | Throws only the LAST error | error_handling | no |
| 9 | No abort signal / cancellation | edge_cases | no |
| 10 | No onRetry callback / no observability hook | edge_cases | no |
| 11 | First attempt has no delay (immediate) | algorithm | no |
| 12 | Sleep via setTimeout + new Promise | defaults | no |
| 13 | options object with optional fields, destructured with defaults | ux | no |
| 14 | lastError typed as unknown | defaults | no |


### Extraction · `naive`

_No output found — run `bun run extract` first._

### Extraction · `structured`

_No output found — run `bun run extract` first._

### Extraction · `adversarial`

_No output found — run `bun run extract` first._

---

## Scoring worksheet

Fill in by hand after reading the report. "Hits" = ground-truth items the strategy surfaced (with reasonable wording match). "FPs" = strategy items that don't correspond to a real decision (hallucinated, trivial, or duplicate).

| Case | Strategy | GT total | Hits | Recall | FPs | Precision |
|---|---|---|---|---|---|---|
| `01-login` | naive | 17 |  |  |  |  |
| `01-login` | structured | 17 |  |  |  |  |
| `01-login` | adversarial | 17 |  |  |  |  |
| `02-debounce` | naive | 11 |  |  |  |  |
| `02-debounce` | structured | 11 |  |  |  |  |
| `02-debounce` | adversarial | 11 |  |  |  |  |
| `03-retry` | naive | 14 |  |  |  |  |
| `03-retry` | structured | 14 |  |  |  |  |
| `03-retry` | adversarial | 14 |  |  |  |  |

### Verdict

- Average recall across all cells: ____ %
- Best strategy: ____
- Decision: viable ( ≥70% ) / hybrid ( 40-70% ) / pivot to Socratic ( <40% )
