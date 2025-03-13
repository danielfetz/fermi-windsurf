# Fermi Poker

A multiplayer poker-style game based on Fermi questions and estimation.

## About the Game

Fermi Poker combines the betting mechanics of poker with the challenge of Fermi estimation questions. Players make range estimates on quantitative questions and bet on the accuracy of their guesses.

## Features

- User authentication with support for guest players
- Create and join games with invite codes
- Real-time multiplayer gameplay
- Betting system inspired by poker
- Fermi-style estimation questions

## Deployment Instructions

### Prerequisites

- [Supabase](https://supabase.com) account
- [GitHub](https://github.com) account
- [Vercel](https://vercel.com) account

### Step 1: Set up Supabase

1. Create a new Supabase project
2. In the SQL Editor, run the database setup script found in `setup/supabase_setup.sql`
3. Enable realtime for the `games` table (Database > Replication)
4. Get your Supabase URL and anon/public key from Project Settings > API

### Step 2: Configure Environment Variables

1. Update the `js/config.js` file with your Supabase credentials:
   ```javascript
   const SUPABASE_URL = 'https://your-project-url.supabase.co';
   const SUPABASE_KEY = 'your-supabase-anon-key';
   ```

### Step 3: Deploy to Vercel

1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Configure the build settings:
   - Framework Preset: Other
   - Build Command: `npm run build`
   - Output Directory: `.`
4. Add Environment Variables in Vercel project settings:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_KEY`: Your Supabase anon/public key
5. Deploy your application

## Local Development

1. Clone the repository
2. Create a `.env.local` file with your Supabase credentials:
   ```
   SUPABASE_URL=https://your-project-url.supabase.co
   SUPABASE_KEY=your-supabase-anon-key
   ```
3. Run `node build.js` to inject the environment variables into your config.js file
4. Open `index.html` in your browser or use a local server

## License

MIT
