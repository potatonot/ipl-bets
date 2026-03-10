-- ============================================================
-- IPL BETS - SUPABASE DATABASE SCHEMA
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES TABLE (extends auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  balance DECIMAL(12,2) NOT NULL DEFAULT 1000.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TEAMS TABLE
-- ============================================================
CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  short_name TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  color TEXT NOT NULL,
  home_ground TEXT NOT NULL
);

INSERT INTO teams (short_name, full_name, color, home_ground) VALUES
  ('CSK', 'Chennai Super Kings', '#F9CD1F', 'MA Chidambaram Stadium, Chennai'),
  ('MI', 'Mumbai Indians', '#005DA0', 'Wankhede Stadium, Mumbai'),
  ('RCB', 'Royal Challengers Bengaluru', '#EC1C24', 'M Chinnaswamy Stadium, Bengaluru'),
  ('KKR', 'Kolkata Knight Riders', '#3A225D', 'Eden Gardens, Kolkata'),
  ('DC', 'Delhi Capitals', '#0078BC', 'Arun Jaitley Stadium, Delhi'),
  ('PBKS', 'Punjab Kings', '#ED1B24', 'PCA Stadium, Mullanpur'),
  ('RR', 'Rajasthan Royals', '#EA1A85', 'Sawai Mansingh Stadium, Jaipur'),
  ('SRH', 'Sunrisers Hyderabad', '#F7A721', 'Rajiv Gandhi International Stadium, Hyderabad'),
  ('GT', 'Gujarat Titans', '#1C1C1C', 'Narendra Modi Stadium, Ahmedabad'),
  ('LSG', 'Lucknow Super Giants', '#A0E1FF', 'BRSABV Ekana Cricket Stadium, Lucknow');

-- ============================================================
-- MATCHES TABLE
-- ============================================================
CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  match_number INTEGER NOT NULL,
  team1_id INTEGER REFERENCES teams(id) NOT NULL,
  team2_id INTEGER REFERENCES teams(id) NOT NULL,
  venue TEXT NOT NULL,
  match_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'completed', 'abandoned')),
  winner_id INTEGER REFERENCES teams(id),
  team1_score TEXT,
  team2_score TEXT,
  match_type TEXT NOT NULL DEFAULT 'league' CHECK (match_type IN ('league', 'qualifier1', 'eliminator', 'qualifier2', 'final')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BETS TABLE
-- ============================================================
CREATE TABLE bets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  team_id INTEGER REFERENCES teams(id) NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  odds DECIMAL(5,2) NOT NULL DEFAULT 2.00,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'refunded')),
  payout DECIMAL(12,2),
  placed_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  UNIQUE(user_id, match_id)
);

-- ============================================================
-- TRANSACTIONS TABLE (audit trail)
-- ============================================================
CREATE TABLE transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bet_placed', 'bet_won', 'bet_lost', 'refund', 'deposit', 'admin_adjust')),
  amount DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  description TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Profiles: users can see all profiles (for leaderboard), only edit own
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Teams: public read
CREATE POLICY "Teams are viewable by everyone" ON teams
  FOR SELECT USING (true);

-- Matches: public read
CREATE POLICY "Matches are viewable by everyone" ON matches
  FOR SELECT USING (true);

-- Bets: users see all bets (for leaderboard context), insert/update own
CREATE POLICY "Bets are viewable by authenticated users" ON bets
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert own bets" ON bets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bets" ON bets
  FOR UPDATE USING (auth.uid() = user_id);

-- Transactions: users see own only
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- ADMIN POLICIES (service role bypasses RLS)
-- ============================================================
-- Admins use service role key to bypass RLS for settling bets, 
-- updating match results, and adjusting balances.

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update updated_at on profile change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- STATS VIEW (for leaderboard)
-- ============================================================
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.id,
  p.username,
  p.display_name,
  p.balance,
  p.balance - 1000.00 AS net_profit,
  COUNT(b.id) AS total_bets,
  COUNT(CASE WHEN b.status = 'won' THEN 1 END) AS bets_won,
  COUNT(CASE WHEN b.status = 'lost' THEN 1 END) AS bets_lost,
  COALESCE(SUM(CASE WHEN b.status = 'won' THEN b.amount END), 0) AS total_wagered_won,
  CASE 
    WHEN COUNT(CASE WHEN b.status IN ('won','lost') THEN 1 END) > 0
    THEN ROUND(
      COUNT(CASE WHEN b.status = 'won' THEN 1 END)::DECIMAL / 
      COUNT(CASE WHEN b.status IN ('won','lost') THEN 1 END) * 100, 1
    )
    ELSE 0
  END AS win_rate
FROM profiles p
LEFT JOIN bets b ON b.user_id = p.id
GROUP BY p.id, p.username, p.display_name, p.balance
ORDER BY net_profit DESC;

-- ============================================================
-- SAMPLE IPL 2026 MATCHES (first 20 fixtures - update as schedule releases)
-- ============================================================
INSERT INTO matches (match_number, team1_id, team2_id, venue, match_date, match_type) VALUES
  (1,  3, 7,  'M Chinnaswamy Stadium, Bengaluru',         '2026-03-28 19:30:00+05:30', 'league'),
  (2,  9, 4,  'Narendra Modi Stadium, Ahmedabad',          '2026-03-29 15:30:00+05:30', 'league'),
  (3,  2, 6,  'Wankhede Stadium, Mumbai',                  '2026-03-29 19:30:00+05:30', 'league'),
  (4,  1, 8,  'MA Chidambaram Stadium, Chennai',           '2026-03-30 19:30:00+05:30', 'league'),
  (5,  5, 10, 'Arun Jaitley Stadium, Delhi',               '2026-03-31 19:30:00+05:30', 'league'),
  (6,  4, 3,  'Eden Gardens, Kolkata',                     '2026-04-01 19:30:00+05:30', 'league'),
  (7,  7, 2,  'Sawai Mansingh Stadium, Jaipur',            '2026-04-02 19:30:00+05:30', 'league'),
  (8,  8, 9,  'Rajiv Gandhi International Stadium, Hyderabad', '2026-04-03 19:30:00+05:30', 'league'),
  (9,  6, 1,  'PCA Stadium, Mullanpur',                    '2026-04-04 19:30:00+05:30', 'league'),
  (10, 10, 5, 'BRSABV Ekana Cricket Stadium, Lucknow',     '2026-04-05 19:30:00+05:30', 'league'),
  (11, 3, 2,  'M Chinnaswamy Stadium, Bengaluru',          '2026-04-06 19:30:00+05:30', 'league'),
  (12, 1, 9,  'MA Chidambaram Stadium, Chennai',           '2026-04-07 19:30:00+05:30', 'league'),
  (13, 4, 8,  'Eden Gardens, Kolkata',                     '2026-04-08 19:30:00+05:30', 'league'),
  (14, 5, 6,  'Arun Jaitley Stadium, Delhi',               '2026-04-09 19:30:00+05:30', 'league'),
  (15, 7, 10, 'Sawai Mansingh Stadium, Jaipur',            '2026-04-10 19:30:00+05:30', 'league'),
  (16, 2, 9,  'Wankhede Stadium, Mumbai',                  '2026-04-11 15:30:00+05:30', 'league'),
  (17, 3, 1,  'M Chinnaswamy Stadium, Bengaluru',          '2026-04-11 19:30:00+05:30', 'league'),
  (18, 6, 4,  'PCA Stadium, Mullanpur',                    '2026-04-12 15:30:00+05:30', 'league'),
  (19, 8, 5,  'Rajiv Gandhi International Stadium, Hyderabad', '2026-04-12 19:30:00+05:30', 'league'),
  (20, 10, 1, 'BRSABV Ekana Cricket Stadium, Lucknow',     '2026-04-13 19:30:00+05:30', 'league');

-- ============================================================
-- DONE. 
-- Next steps:
-- 1. Go to Authentication > Settings > enable Email signup
-- 2. Set up redirect URLs for your GitHub Pages domain
-- 3. Copy your project URL and anon key to your .env file
-- ============================================================
