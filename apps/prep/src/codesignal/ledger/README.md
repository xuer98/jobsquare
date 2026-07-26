---

## In-Memory Ledger

A payments ledger. Accounts hold an integer balance; amounts are positive integers. Timestamps arrive non-decreasing.

### Level 1 — Core operations

```
create_account(timestamp, account_id) -> bool
    Create account with balance 0. false if it already exists, else true.

deposit(timestamp, account_id, amount) -> int | None
    Add amount to balance; return new balance. None if account missing.

transfer(timestamp, source_id, target_id, amount) -> int | None
    Move amount source -> target; return source's new balance.
    None if either account is missing, source == target, or balance < amount.
```

### Level 2 — Aggregation (reuses L1)

```
top_spenders(timestamp, n) -> string
    Top n accounts by total outgoing amount (everything sent via transfer).
    Sort by amount desc, ties by account_id asc.
    Format: "id1(amt1), id2(amt2), ...". Fewer than n accounts -> return all.
```

The trap: this is trivial only if `transfer` already accumulated a per-account outgoing total back in Level 1. If it didn't, you refactor now.

### Level 3 — Extend + refactor (the real difficulty)

```
schedule_payment(timestamp, account_id, amount, delay) -> string | None
    Register an outgoing payment to execute at (timestamp + delay).
    Do NOT execute now. Return unique id "payment1", "payment2", ...
    None if account doesn't exist.

cancel_payment(timestamp, account_id, payment_id) -> bool
    Cancel a not-yet-executed payment owned by account_id.
    false if missing, wrong owner, or already executed.
```

Execution semantics: at the start of **every** operation, execute all pending payments whose scheduled time `<= current timestamp`, ordered by scheduled time then creation order. On execution, if `balance >= amount` deduct it and add to the account's outgoing total (so it counts toward `top_spenders`); otherwise the payment fails and is discarded. The clean move is one private `_process_due(timestamp)` called at the top of every public method.

### Level 4 — Backward-compatible additions

```
merge_accounts(timestamp, id_1, id_2) -> bool
    Merge id_2 into id_1: id_1 absorbs id_2's balance, outgoing total, and
    pending payments (which keep their ids and still fire, now billed to id_1).
    Remove id_2. false if either missing or id_1 == id_2.
    cancel_payment(..., id_1, "paymentX") must still work for a payment that
    originally belonged to id_2.

get_balance(timestamp, account_id, time_at) -> int | None
    Return account_id's balance as it was at time_at. None if the account
    didn't exist at time_at. Must stay correct even if the account was later
    merged away.
```

`get_balance` rewards good L1 modeling: if you kept a time-ordered `(timestamp, balance)` log per account, it's a binary search; if you only kept the current balance, you're stuck.

### Verified trace

```
create_account(1, "a")            -> True
create_account(2, "b")            -> True
deposit(3, "a", 100)              -> 100
transfer(4, "a", "b", 30)         -> 70
transfer(5, "a", "b", 20)         -> 50
top_spenders(6, 3)                -> "a(50), b(0)"
schedule_payment(7, "b", 40, 10)  -> "payment1"    # fires at 17
deposit(18, "a", 0)               -> 50             # payment1 fires: b 50->10
top_spenders(19, 2)               -> "a(50), b(40)" # b's payment counted
get_balance(20, "b", 3)           -> 0
get_balance(21, "b", 6)           -> 50
get_balance(22, "b", 18)          -> 10
create_account(25, "c")           -> True
deposit(26, "c", 100)             -> 100
schedule_payment(27, "c", 30, 100)-> "payment2"     # fires at 127
merge_accounts(28, "a", "c")      -> True           # a absorbs c; payment2 -> a
cancel_payment(29, "a", "payment2")-> True          # cancellable via new owner
get_balance(30, "c", 26)          -> 100            # frozen pre-merge history
get_balance(31, "c", 30)          -> None           # c gone after merge at 28
```
