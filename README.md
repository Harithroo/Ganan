# Ganan - Group Expense Splitter

A simple, clean web app to split group expenses and calculate fair settlements using a greedy algorithm.

## Features

✨ **Add People** - Create a list of group members  
💰 **Track Expenses** - Record who paid and for whom  
🔢 **Calculate Balances** - Automatic balance calculation for each person  
🤝 **Smart Settlements** - Greedy algorithm to minimize transaction count  
📱 **Responsive Design** - Works on desktop and mobile  
🚀 **Offline Ready** - Service worker caching for offline access  
⚡ **Lightweight** - Vanilla JavaScript + Umbrella JS only  

## How It Works

1. **Add People** - Enter names of group members
2. **Add Expenses** - Record who paid and for whom
3. **View Balances** - See who owes and who is owed money
4. **View Settlements** - Get the optimal payment instructions

## Settlement Algorithm

The app uses a greedy algorithm to calculate minimum settlements:
- Splits all balances into debtors (negative) and creditors (positive)
- Sorts both lists by amount
- Matches lowest debtor with lowest creditor iteratively
- This minimizes the number of transactions needed

## Tech Stack

- **HTML5** - Structure
- **CSS3** - Styling with gradients and responsive design
- **JavaScript** - Vanilla ES6+ for logic
- **Umbrella JS 3.3.6** - DOM manipulation via CDN
- **Service Worker** - Offline capability

## File Structure

```
index.html       - Main HTML structure
app.js           - Core application logic
style.css        - All styling
sw.js            - Service worker for offline support
manifest.json    - PWA manifest for installation
```

## Usage

Simply open `index.html` in a modern web browser. No build process or backend required.

## Data Storage

All data is stored in memory (JavaScript). Refresh the page to clear all data.  
To persist data, you can implement localStorage in `app.js`.

## License

Free to use and modify.
personal project for an app
