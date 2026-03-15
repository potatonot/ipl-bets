import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'ipl-bets-auth',
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  db: { schema: 'public' },
  global: {
    fetch: (url, options = {}) => {
      return fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
    },
  },
});

// Keep Supabase warm — ping every 4 minutes so it never cold-starts
let keepAliveTimer = null;
export const startKeepAlive = () => {
  if (keepAliveTimer) return;
  const ping = () => supabase.from('teams').select('id').limit(1).then(() => {});
  ping();
  keepAliveTimer = setInterval(ping, 4 * 60 * 1000);
};
export const stopKeepAlive = () => {
  if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
};

// ── Auth helpers ──────────────────────────────────────────────
export const signUp = async (email, password, username, displayName) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username, display_name: displayName } },
  });
  return { data, error };
};

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
};

export const signOut = async () => {
  stopKeepAlive();
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return { data, error };
};

// ── Match helpers ─────────────────────────────────────────────
export const getMatches = async () => {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      team1:teams!matches_team1_id_fkey(*),
      team2:teams!matches_team2_id_fkey(*),
      winner:teams!matches_winner_id_fkey(*)
    `)
    .order('match_date', { ascending: true });
  return { data, error };
};

export const getMatch = async (matchId) => {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      team1:teams!matches_team1_id_fkey(*),
      team2:teams!matches_team2_id_fkey(*),
      winner:teams!matches_winner_id_fkey(*)
    `)
    .eq('id', matchId)
    .single();
  return { data, error };
};

// ── Bet helpers ───────────────────────────────────────────────
// odds = 0 means "peer-to-peer" — payout calculated at settlement time
export const placeBet = async (userId, matchId, teamId, amount) => {
  const { data: bet, error: betError } = await supabase
    .from('bets')
    .insert({ user_id: userId, match_id: matchId, team_id: teamId, amount, odds: 0 })
    .select()
    .single();

  if (betError) return { error: betError };

  // Log transaction in background
  supabase.from('transactions').insert({
    user_id: userId,
    type: 'bet_placed',
    amount: amount,
    balance_after: 0,
    description: `Bet placed on match #${matchId}`,
    reference_id: bet.id,
  });

  return { data: bet, error: null };
};

export const getUserBets = async (userId) => {
  const { data, error } = await supabase
    .from('bets')
    .select(`
      *,
      team:teams(*),
      match:matches(
        *,
        team1:teams!matches_team1_id_fkey(*),
        team2:teams!matches_team2_id_fkey(*),
        winner:teams!matches_winner_id_fkey(*)
      )
    `)
    .eq('user_id', userId)
    .order('placed_at', { ascending: false });
  return { data, error };
};

export const getBetsForMatch = async (matchId) => {
  const { data, error } = await supabase
    .from('bets')
    .select(`*, user:profiles(username, display_name), team:teams(*)`)
    .eq('match_id', matchId);
  return { data, error };
};

// ── Leaderboard ───────────────────────────────────────────────
export const getLeaderboard = async () => {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .order('net_profit', { ascending: false });
  return { data, error };
};

// ── Transactions ──────────────────────────────────────────────
export const getUserTransactions = async (userId) => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  return { data, error };
};

// ── Admin: settle match (peer-to-peer model) ──────────────────
//
// Rules:
//   - Everyone bets the same amount
//   - Winners get: (number of losers) × bet_amount  as profit
//   - Losers get: 0  (they already put in their bet_amount)
//   - If no opponents exist: winner gets nothing (net 0, bet returned)
//
export const settleMatch = async (matchId, winnerId, team1Score, team2Score) => {
  // 1. Update match result
  const { error: matchError } = await supabase
    .from('matches')
    .update({
      status: 'completed',
      winner_id: winnerId,
      team1_score: team1Score,
      team2_score: team2Score,
    })
    .eq('id', matchId);
  if (matchError) return { error: matchError };

  // 2. Get all pending bets
  const { data: bets, error: betsError } = await supabase
    .from('bets')
    .select('*')
    .eq('match_id', matchId)
    .eq('status', 'pending');
  if (betsError) return { error: betsError };

  if (bets.length === 0) return { error: null };

  // Force parseInt on both sides — Supabase can return team_id as string
  const winnerBets = bets.filter((b) => parseInt(b.team_id) === parseInt(winnerId));
  const loserBets  = bets.filter((b) => parseInt(b.team_id) !== parseInt(winnerId));

  const loserCount = loserBets.length;

  // 3. Settle winners
  for (const bet of winnerBets) {
    // Profit = number of losers × this person's bet amount
    // If no losers, payout = bet amount back (net zero, no profit)
    const profit = loserCount > 0 ? loserCount * Number(bet.amount) : 0;
    const payout = Number(bet.amount) + profit; // stake back + profit

    await supabase
      .from('bets')
      .update({
        status: 'won',
        payout,
        settled_at: new Date().toISOString(),
      })
      .eq('id', bet.id);

    supabase.from('transactions').insert({
      user_id: bet.user_id,
      type: 'bet_won',
      amount: profit, // net profit only (not stake)
      balance_after: 0,
      description: `Won ₹${profit} from ${loserCount} opponent${loserCount !== 1 ? 's' : ''} on match #${matchId}`,
      reference_id: bet.id,
    });
  }

  // 4. Settle losers
  for (const bet of loserBets) {
    await supabase
      .from('bets')
      .update({
        status: 'lost',
        payout: 0,
        settled_at: new Date().toISOString(),
      })
      .eq('id', bet.id);
  }

  return { error: null };
};
