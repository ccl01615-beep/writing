# Trendline Desk

A small always-on-top window that floats over your broker app. You type a ticker, and it:

- pulls the live price and two years of daily history from Yahoo Finance's public feed
- refreshes about every minute while the market is open, and every 10 minutes when it's closed
- reads the trend, momentum and volatility: 20/50/200-day averages, trend channel, swing structure, RSI, MACD, Bollinger squeeze, breakouts, divergences
- finds support and resistance from past swing highs and lows
- lays out a **bullish path**, a **trend-continues** projection with a 68%/95% range cone, and a **bearish path**, each with trigger levels
- shows what this stock did in the past when it was in the same state (e.g. RSI over 70 and above both averages)

It does not connect to your brokerage or see your account. It looks up the same ticker independently.

## Install on Windows

1. Open this repository's **Releases** page on GitHub and choose **Trendline Desk for Windows**.
2. Download `TrendlineDesk-Setup-….exe` and run it. The portable `.exe` runs without installing.
3. If Windows shows "Windows protected your PC", click **More info**, then **Run anyway**. It appears because the app isn't code-signed.

A fresh build is published automatically every time code in `trendline-desk/` changes.

## Run from source (optional)

1. Install [Node.js](https://nodejs.org) (the LTS version).
2. In a terminal:
   ```
   cd trendline-desk
   npm install
   npm start
   ```

## Using it

- **Ticker box**: type a symbol and press Enter. Non-US listings use Yahoo's suffixes, e.g. `SHOP.TO` or `VOD.L`. Indexes use `^`, e.g. `^GSPC`.
- **Watchlist chips**: click to switch and × to remove. Each chip shows the day's change.
- **Drag** the window by its top bar. Its size and position are remembered.
- **Title bar buttons**: an opacity slider, a pin to keep the window on top (on by default), compact view (just the price and verdicts), minimize and close.
- **Ctrl+Shift+Y** (⌘⇧Y on Mac) shows or hides the window from anywhere.
- **Hover the chart** for prices. Hovering the shaded cone on the right shows the projected range for each future day.

## Limits

- Yahoo's free feed can lag real time by seconds to a few minutes, and Yahoo can change or rate-limit it without notice.
- All the analysis is technical, based only on price and volume. It knows nothing about earnings, news or fundamentals.
- Patterns describe tendencies, not certainties. This is not financial advice.

## Development

- `analysis.js`: the analysis engine, as pure functions
- `feed.js`: turns Yahoo's response into daily bars
- `main.js`: the window and data fetching (Electron main process)
- `overlay.html`: the UI
- `npm test`: runs unit tests on synthetic data (no internet needed)
