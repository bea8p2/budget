# TODO – Budget App (focused)

This file tracks WHAT to do next. Details live in NOTES.md.

---

## ✅ NOW (current focus — small, low-risk improvements)
- [ ] Backend: add basic validation to POST /accounts and POST /transactions (required fields, types)
- [ ] Backend: friendly error messages (400 for validation, 404 for missing resources)
- [ ] Frontend: show inline errors under forms (Accounts, Transactions, Budgets)
- [ ] Frontend: disable submit buttons during requests (re-enable after)
- [ ] Frontend: default dates/month fields to current UTC (ensure they show on load)

---

## 🔜 NEXT (after testing the above at home)
- [ ] Frontend: confirm dialogs for deletes (transactions)
- [ ] Frontend: keep “Settings → API Base” & “Demo User” in localStorage (already works; just verify)
- [ ] Frontend: format amounts consistently as currency (negative in red)
- [ ] Backend: clamp budgets month to 1–12; validate limit is a number
- [ ] Backend: add 429-safe guardrail (simple rate limit on auth later)

---

## 🕒 LATER (nice-to-have)
- [ ] Client-side category autocomplete (from existing transactions)
- [ ] CSV import (MVP: parse + POST /transactions in batches)
- [ ] Move monthly summary computation to a server endpoint
- [ ] Add pagination to transactions (limit/skip)

---

## 🧹 CLEANUP / QUESTIONS
- [ ] Do we want split transactions (one receipt → multiple categories)?
- [ ] Agree on a minimal category list for MVP?
- [ ] Decide final naming: “Budget” vs “Plan”