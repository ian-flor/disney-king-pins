# Disney King Pins - Member Auction Rules Agreement

A simple web application for the Disney King Pins Facebook group to display member auction rules and capture agreement signatures.

## Features

- Display all 29 member auction rules in collapsible sections
- Agreement form with first/last name and checkbox
- Unique confirmation code for each submission (DKP-XXXXXX format)
- Admin dashboard to view all agreements
- Export to CSV
- Mobile-responsive Facebook-inspired design

## Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Vercel (free tier)
- **Cost**: $0/year

---

## Setup Instructions

### 1. Create a Supabase Account

1. Go to [supabase.com](https://supabase.com) and sign up for a free account
2. Create a new project (remember your database password)
3. Wait for the project to finish setting up (~2 minutes)

### 2. Create the Database Table

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Paste the following SQL and click **Run**:

```sql
-- Create agreements table
CREATE TABLE agreements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  confirmation_code VARCHAR(10) UNIQUE NOT NULL,
  agreed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_hash VARCHAR(64),
  user_agent TEXT
);

-- Create indexes for faster queries
CREATE INDEX idx_agreements_confirmation ON agreements(confirmation_code);
CREATE INDEX idx_agreements_name ON agreements(last_name, first_name);
CREATE INDEX idx_agreements_date ON agreements(agreed_at DESC);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows inserts from anyone (for the public form)
CREATE POLICY "Allow public inserts" ON agreements
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create a policy that allows reads from anyone (for the admin page)
CREATE POLICY "Allow public reads" ON agreements
  FOR SELECT
  TO anon
  USING (true);
```

### 3. Get Your Supabase Credentials

1. In your Supabase dashboard, go to **Settings** > **API**
2. Copy the **Project URL** (looks like `https://xxxxx.supabase.co`)
3. Copy the **anon public** key (a long string starting with `eyJ...`)

### 4. Update the JavaScript Files

1. Open `js/main.js` and replace:
   ```javascript
   const SUPABASE_URL = 'YOUR_SUPABASE_URL';
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
   ```
   With your actual values.

2. Open `js/admin.js` and make the same changes.

### 5. Add Your Banner Image

1. Save the Disney King Pins banner image as `images/banner.png`
2. Recommended size: 680px wide (will scale automatically)

### 6. Deploy to Vercel

**Option A: Using Vercel CLI**

1. Install Vercel CLI: `npm i -g vercel`
2. Navigate to the project folder: `cd "Disney King Pins"`
3. Run: `vercel`
4. Follow the prompts to deploy

**Option B: Using Vercel Dashboard**

1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click **Add New** > **Project**
3. Import from Git or upload the folder
4. Click **Deploy**

### 7. (Optional) Set Up a Custom Domain

1. In Vercel, go to your project settings
2. Click **Domains**
3. Add your custom domain and follow DNS instructions

---

## Admin Access

- Navigate to `/admin` or `/admin.html`
- Default password: `dkp2024`
- **Important**: Change this password in `js/admin.js` before going live!

```javascript
const ADMIN_PASSWORD = 'your-secure-password-here';
```

---

## Local Testing

You can test locally without Supabase - the app will fall back to localStorage:

1. Open `index.html` in a browser (or use a local server)
2. Submit the form - data saves to browser localStorage
3. Open `admin.html` to see saved submissions

To run with a local server:
```bash
# Using Python
python -m http.server 8000

# Using Node.js (npx)
npx serve

# Then open http://localhost:8000
```

---

## File Structure

```
Disney King Pins/
├── index.html          # Main rules & agreement page
├── admin.html          # Admin dashboard
├── css/
│   └── styles.css      # Facebook-inspired styles
├── js/
│   ├── main.js         # Form handling & Supabase
│   └── admin.js        # Admin page logic
├── images/
│   └── banner.png      # Your banner image
├── vercel.json         # Vercel config
└── README.md           # This file
```

---

## Security Notes

1. **Admin Password**: The current setup uses a simple password stored in JavaScript. For better security:
   - Use Supabase Auth for admin login
   - Or create a serverless function for authentication

2. **Row Level Security**: The SQL above enables RLS with public read/write. For tighter security:
   - Restrict reads to authenticated users only
   - Use a serverless function to handle inserts

3. **Rate Limiting**: Supabase has built-in rate limiting, but consider adding Vercel Edge Functions for additional protection against spam.

---

## Customization

### Change Colors
Edit the CSS variables in `css/styles.css`:
```css
:root {
    --fb-blue: #1877F2;
    /* ... other colors */
}
```

### Change Admin Password
Edit `js/admin.js`:
```javascript
const ADMIN_PASSWORD = 'your-new-password';
```

### Modify Rules
Edit the rules directly in `index.html` within the accordion sections.

---

## Support

For issues or questions about the Disney King Pins group, contact the group admins.

---

*Rules updated: 7.21.25*
