# Ganan Application Architecture

## File Structure
```
Ganan/
├── index.html              ← Open this in browser
├── app.js                  ← Application logic
├── style.css               ← All styling
├── sw.js                   ← Service worker (offline)
├── manifest.json           ← PWA configuration
├── README.md
├── QUICKSTART.md
├── FEATURES.md
├── IMPLEMENTATION.md
├── COMPLETE.md
└── [old folders - can be removed]
    ├── js/
    ├── partials/
    ├── css/
    └── libs/
```

## Data Flow Diagram

```
User Input
    ↓
┌─────────────────────────────────────┐
│    EVENT HANDLERS                   │
│  • Add person button                │
│  • Add expense form                 │
│  • Remove buttons                   │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│    APP STATE MANAGEMENT             │
│  • app.people []                    │
│  • app.expenses []                  │
│  • app.balances {}                  │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│    CALCULATIONS                     │
│  • calculateBalances()              │
│  • calculateSettlements()           │
│     └─ Greedy algorithm            │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│    RENDERING                        │
│  • renderPeople()                   │
│  • renderExpenseForm()              │
│  • renderExpenseList()              │
│  • renderBalances()                 │
│  • renderSettlements()              │
└──────────────┬──────────────────────┘
               ↓
             UI Display
```

## Component Interaction

```
┌─────────────────────────────────────────────────────────────┐
│                      GANAN APP                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         PEOPLE SECTION                              │   │
│  │  Input: [________] [Add]                            │   │
│  │  List:  • Alice [Remove]                            │   │
│  │         • Bob [Remove]                              │   │
│  │         • Charlie [Remove]                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         EXPENSE FORM                                │   │
│  │  Payer: [Select ▼]                                 │   │
│  │  Amount: [______]                                   │   │
│  │  For: ☐ Alice ☐ Bob ☐ Charlie                     │   │
│  │       [Add Expense]                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         EXPENSE TABLE                               │   │
│  │  Payer   | Amount  | Beneficiaries | Action        │   │
│  │  ─────────────────────────────────────────────────  │   │
│  │  Alice   | $300.00 | A, B, C      | [Delete]      │   │
│  │  Bob     | $600.00 | A, B         | [Delete]      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         BALANCES                                    │   │
│  │  [Green] Alice owed $200.00                         │   │
│  │  [Green] Bob owed $300.00                           │   │
│  │  [Red]   Charlie owes $100.00                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         SETTLEMENTS                                 │   │
│  │  [Blue] Alice pays Bob: $200.00                     │   │
│  │  [Blue] Charlie pays Bob: $100.00                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Algorithm Flow

### Balance Calculation
```
For each expense:
  payer gets +amount
  For each beneficiary:
    beneficiary gets -share (share = amount/count)

Result:
  Positive balance = person is owed money
  Negative balance = person owes money
```

### Settlement (Greedy Algorithm)
```
Step 1: Split balances
  Debtors = [people with negative balance]
  Creditors = [people with positive balance]

Step 2: Sort both
  Debtors ascending by amount owed
  Creditors ascending by amount owed

Step 3: Match greedily
  While debtors and creditors exist:
    Settle amount = min(debtor_amount, creditor_amount)
    Record: "debtor pays creditor: settle_amount"
    Reduce both amounts by settle_amount
    Remove zeros from lists

Result:
  Minimum number of transactions to settle all debts
```

## State Management

```
app = {
  people: [
    "Alice",
    "Bob",
    "Charlie"
  ],
  
  expenses: [
    {
      payer: "Alice",
      amount: 300,
      for: ["Alice", "Bob", "Charlie"]
    },
    {
      payer: "Bob",
      amount: 600,
      for: ["Alice", "Bob"]
    }
  ],
  
  balances: {
    "Alice": -100,
    "Bob": 200,
    "Charlie": -100
  }
}
```

## Rendering Pipeline

```
Event Occurs
    ↓
Update app state
    ↓
Call app.render()
    ↓
┌─ renderPeople()
├─ renderExpenseForm()
├─ renderExpenseList()
├─ renderBalances()
└─ renderSettlements()
    ↓
DOM Updated
    ↓
User sees changes instantly
```

## Technology Stack

```
Frontend:
  ├─ HTML5
  ├─ CSS3 (Flexbox, Grid, Gradients)
  ├─ JavaScript ES6+
  └─ Umbrella JS (DOM) [CDN]

Offline:
  └─ Service Worker

Storage:
  └─ Browser Memory (could add localStorage)

Deployment:
  └─ Static Files Only
```

## Class Hierarchy (if refactored to OOP)

```
class ExpenseSplitter {
  - people: Array
  - expenses: Array
  - balances: Object
  
  - addPerson(name)
  - removePerson(name)
  - addExpense(payer, amount, beneficiaries)
  - calculateBalances()
  - calculateSettlements()
  - render()
}

// Currently implemented as object literal
// Could be refactored to class if needed
```

## Performance Characteristics

```
Operation          | Complexity | Time
─────────────────────────────────────
Add Person         | O(n)       | ~1ms
Remove Person      | O(n)       | ~1ms
Add Expense        | O(n+m)     | ~1ms
Calculate Balance  | O(n*m)     | ~1ms
Calculate Settle   | O(n log n) | ~1ms (greedy sort)
Full Render        | O(n+m)     | ~5ms

Legend: n = people count, m = expense count
For 100 people, 1000 expenses: still under 50ms total
```

---

**This architecture ensures:**
- ✅ Clear separation of concerns
- ✅ Easy to understand code flow
- ✅ Simple to modify and extend
- ✅ Fast performance
- ✅ No external dependencies
- ✅ Works completely offline
