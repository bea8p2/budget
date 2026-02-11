# Budget App – Data Model Notes

## Core Conventions
- Expenses are **negative** amounts; income is **positive**.
- All documents include **userId** and all queries must filter by userId.
- Budgets are **per (year, month)**. MVP has **no rollover**.
- Categories are simple **strings** for MVP (no separate categories collection).


## Collections
- `users`: { email, passwordHash, createdAt }
- `accounts`: { userId, name, type, currency, createdAt }
- `transactions`: { userId, accountId, date, amount, category, note, tags, createdAt, updatedAt }
- `budgets`: { userId, period:{year,month}, limits:[{category,limit}], createdAt, updatedAt }

## Indexing Plan
- transactions: { userId, date:-1 }, { userId, category:1 }
- users: { email:1, unique:true }
- budgets: unique on (userId, year, month)

## Open Questions / Future
- Do we want category normalization (a `categories` collection) later?
- Add currency per account only (no per-transaction currency in MVP).
- Rollover rules (future): unused budget can optionally roll into next month.
- Freemium model with future months restricted to paywall. Only current month allowed under free period.