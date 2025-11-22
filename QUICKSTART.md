# Quick Start Guide - Ganan

## Opening the App

Simply open `index.html` in your web browser. No installation or build process needed.

### Desktop
- Windows: Double-click `index.html` or drag to browser
- Mac/Linux: Double-click `index.html` or right-click → Open With

### Mobile
- Open this file path in your mobile browser
- You can add to home screen for app-like experience

## Step-by-Step Example

### 1. Add Group Members
```
Input: "Alice" → Click Add
Input: "Bob" → Click Add
Input: "Charlie" → Click Add
```
You'll see them listed under "People"

### 2. Record an Expense
```
Select Payer: Alice
Amount: 300
Beneficiaries: ✓ Alice ✓ Bob ✓ Charlie
Click "Add Expense"
```

### 3. Add Another Expense
```
Select Payer: Bob
Amount: 600
Beneficiaries: ✓ Alice ✓ Bob
Click "Add Expense"
```

### 4. View Results

**Expenses** section shows:
| Payer | Amount | Beneficiaries | 
|-------|--------|---------------|
| Alice | $300.00 | Alice, Bob, Charlie |
| Bob | $600.00 | Alice, Bob |

**Balances** section shows:
- Bob owes $300.00 (green - he's owed)
- Alice owes $200.00 (green - she's owed)  
- Charlie owes $100.00 (red - he owes)

**Settlements** section shows:
- Charlie pays Bob: $100.00
- Alice pays Bob: $200.00

This is the minimum number of transactions needed!

## Features You Can Use

✅ **Add/Remove People** - Click Remove next to any person
✅ **Delete Expense** - Click Delete in the expense table
✅ **Auto-updates** - All calculations update instantly
✅ **Validation** - Can't add invalid data
✅ **Works Offline** - Service worker caches the app

## Data

- **Saved in memory** - Data clears when you refresh
- **No internet needed** - Everything runs locally
- To add permanent storage, modify `app.js` to use localStorage

## Browser Support

Works in all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari 14+

## Questions?

The app is self-explanatory. Try:
1. Adding different people
2. Recording various expenses
3. Checking how balances change
4. Viewing the settlement algorithm in action

Enjoy splitting expenses fairly!
