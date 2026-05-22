# Lightsmith Business Toolkit

A mobile-first web app for logging jobs, importing Bluevine bank statements, and adding recurring monthly expenses — all written directly to your Google Sheet.

---

## One-Time Setup (~10 minutes)

### Step 1 — Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown at the top → **New Project**
3. Name it **Lightsmith Toolkit** → click **Create**
4. Make sure the new project is selected at the top
5. In the left sidebar, go to **APIs & Services → Library**
6. Search for **Google Sheets API** → click it → click **Enable**

### Step 2 — Create OAuth credentials

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth client ID**
3. If prompted, click **Configure Consent Screen** first:
   - Choose **External** → click **Create**
   - App name: **Lightsmith Toolkit**
   - User support email: your email
   - Developer contact: your email
   - Click **Save and Continue** through all the steps
   - On the **Test users** page, add your Google account email
   - Click **Back to Dashboard**
4. Now click **+ Create Credentials → OAuth client ID** again
5. Application type: **Web application**
6. Name: **Lightsmith Toolkit**
7. Under **Authorized redirect URIs**, click **+ Add URI**
8. Add: `https://YOUR_GITHUB_USERNAME.github.io/lightsmith/`
   *(replace YOUR_GITHUB_USERNAME with your actual GitHub username)*
9. Click **Create**
10. Copy the **Client ID** — it looks like `123456789-abcdefg.apps.googleusercontent.com`

### Step 3 — Add your Client ID to the app

1. Open the `config.js` file in this repo
2. Replace `PASTE_YOUR_CLIENT_ID_HERE.apps.googleusercontent.com` with your Client ID
3. Replace `YOUR_GITHUB_USERNAME` with your GitHub username
4. Save the file

### Step 4 — Enable GitHub Pages

1. Push this folder to a GitHub repo named **lightsmith**
2. Go to your repo → **Settings → Pages**
3. Under **Source**, select **Deploy from a branch**
4. Branch: **main** (or **master**), folder: **/ (root)**
5. Click **Save**
6. Your app will be live at `https://YOUR_USERNAME.github.io/lightsmith/` in ~2 minutes

---

## Using the App

### Logging a job

1. Tap the **Job** tab (🔧)
2. Fill in: date, service type, vehicle, amount, payment method
3. If you took Venmo, check **Auto-deduct Venmo fee** to log the 1.9% + $0.10 fee automatically
4. Tap **Add to Sheet**
5. You'll see "Job logged ✓" and the row appears in your Google Sheet immediately

### Importing a Bluevine statement

1. Download your statement PDF from [app.bluevine.com](https://app.bluevine.com)
   - Go to **Accounts → Statements** → download the PDF for the month you want
2. Tap the **Import** tab (📄)
3. Drag and drop the PDF, or tap to select it
4. Review the transactions — categories are auto-filled but you can change any of them
5. Check the **Skip** box for any transaction you don't want to import
6. Tap **Import X rows**

### Adding monthly recurring expenses

1. Tap the **Recurring** tab (🔁)
2. At the start of each month, tap the big yellow **"Add this month's entries"** button
3. This adds Google Workspace, Claude, Google Ads (and any custom ones you've added) in one tap
4. Use the toggles to turn individual entries on or off
5. Tap **+ Add custom entry** to add new recurring expenses

### Checking totals

Tap the **Dashboard** tab (📊) to see:
- Income, expenses, and net for the current session
- Year-to-date totals pulled live from your Google Sheet

---

## Bookmarking on Your Phone

On iPhone: open the site in **Safari** → tap the **Share** button → **Add to Home Screen**

The app will appear on your home screen like a native app with no browser bar.

---

## Your Google Sheet

The app writes to the **Transactions** sheet in your existing bookkeeping file. Each row has:

| Column | Contents |
|--------|----------|
| A | Date (MM/DD/YYYY) |
| B | Description |
| C | Type (Income or Expense) |
| D | Amount (number) |
| E | Category |
| F | Payment Method |
| G | Notes |
| H | Reimbursed? (left blank) |

---

## Troubleshooting

**"Not connected to Google Sheets" banner won't go away**
→ Tap the banner or the Connect button. Complete the Google sign-in and grant permission. This happens once; it stays connected for about an hour, then you'll need to tap Connect again.

**"No transactions found" after uploading PDF**
→ Make sure you're uploading a Bluevine statement PDF (not a CSV or other bank). Download directly from app.bluevine.com → Accounts → Statements.

**App says "Session expired — reconnect"**
→ Your Google login expired (they last about 1 hour). Tap Connect Sheets to re-authenticate. Your data is safe — nothing was lost.

**The app isn't at the GitHub Pages URL yet**
→ GitHub Pages can take up to 5 minutes to deploy. Check the **Actions** tab in your repo to see deployment status.
