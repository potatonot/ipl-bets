import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMatch, getBetsForMatch, getUserBets, placeBet } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { getCache, setCache, clearCache } from '../lib/cache';

const PRESETS = [100, 250, 500, 1000, 2000, 5000];
const SLIDER_MAX = 10000;

const MatchDetailPage = () => {
  const { id } = useParams();
  const { user, profile, refreshProfile } = useAuth();

  const MATCH_KEY = `match_${id}`;
  const BETS_KEY = `match_bets_${id}`;
  const MY_BET_KEY = `my_bet_${id}_${user?.id}`;

  const [match, setMatch] = useState(() => getCache(MATCH_KEY));
  const [bets, setBets] = useState(() => getCache(BETS_KEY) || []);
  const [myBet, setMyBet] = useState(() => getCache(MY_BET_KEY));
  const [loading, setLoading] = useState(!match);
  const [betLoading, setBetLoading] = useState(false);

  const [selectedTeam, setSelectedTeam] = useState(null);
  const [amount, setAmount] = useState('');
  const [betError, setBetError] = useState('');
  const [betSuccess, setBetSuccess] = useState('');

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    const [{ data: m }, { data: allBets }, { data: myBets }] = await Promise.all([
      getMatch(id),
      getBetsForMatch(id),
      getUserBets(user.id),
    ]);
    if (m) { setMatch(m); setCache(MATCH_KEY, m); }
    if (allBets) { setBets(allBets); setCache(BETS_KEY, allBets); }
    if (myBets) {
      const bet = myBets.find((b) => b.match_id === parseInt(id));
      setMyBet(bet || null);
      setCache(MY_BET_KEY, bet || null);
    }
    setLoading(false);
  };

  useEffect(() => { load(!!match); }, [id]);

  const handlePlaceBet = async () => {
    setBetError('');
    setBetSuccess('');
    const amt = parseFloat(amount);
    if (!selectedTeam) return setBetError('Select a team');
    if (!amt || amt < 1) return setBetError('Enter a bet amount');

    setBetLoading(true);
    const { data, error } = await placeBet(user.id, parseInt(id), selectedTeam, amt);
    if (error) {
      setBetError(error.message);
    } else {
      setBetSuccess('Bet placed successfully!');
      const newBet = { ...data, team: match.team1?.id === selectedTeam ? match.team1 : match.team2 };
      setMyBet(newBet);
      setCache(MY_BET_KEY, newBet);
      // Clear caches that depend on bets so they reload fresh
      clearCache('matches');
      clearCache(`bets_${user.id}`);
      clearCache(`profile_bets_${user.id}`);
      clearCache('leaderboard');
      refreshProfile();
      await load(true);
    }
    setBetLoading(false);
  };

  const formatMoney = (n) =>
    `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  if (loading) return <main className="page-content"><div className="loader"><div className="spinner" />Loading...</div></main>;
  if (!match) return <main className="page-content"><div className="empty">Match not found.</div></main>;

  const team1Bets = bets.filter((b) => b.team_id === match.team1_id);
  const team2Bets = bets.filter((b) => b.team_id === match.team2_id);
  const team1Pool = team1Bets.reduce((s, b) => s + Number(b.amount), 0);
  const team2Pool = team2Bets.reduce((s, b) => s + Number(b.amount), 0);
  const totalPool = team1Pool + team2Pool;

  // Peer-to-peer: opponents are bettors on the other team
  const opponentBets = selectedTeam === match.team1_id ? team2Bets : selectedTeam === match.team2_id ? team1Bets : [];
  const opponentCount = opponentBets.length;
  const potentialProfit = parseFloat(amount || 0) * opponentCount;
  const potentialPayout = parseFloat(amount || 0) + potentialProfit;

  const statusClass = { upcoming: 'badge-upcoming', live: 'badge-live', completed: 'badge-completed', abandoned: 'badge-abandoned' }[match.status];
  const canBet = match.status === 'upcoming' && !myBet;

  return (
    <main className="page-content">
      <div style={{ paddingTop: '24px', marginBottom: '20px' }}>
        <Link to="/matches" style={{ fontSize: '13px', color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          ← Matches
        </Link>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <span className={`badge ${statusClass}`}>{match.status}</span>
          <span style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            Match {match.match_number} · {match.match_type.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: match.team1?.color, margin: '0 auto 8px' }} />
            <div style={{ fontSize: '22px', fontWeight: '600', color: 'var(--text)' }}>{match.team1?.short_name}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px' }}>{match.team1?.full_name}</div>
            {match.team1_score && <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--text)', marginTop: '8px' }}>{match.team1_score}</div>}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>vs</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: match.team2?.color, margin: '0 auto 8px' }} />
            <div style={{ fontSize: '22px', fontWeight: '600', color: 'var(--text)' }}>{match.team2?.short_name}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px' }}>{match.team2?.full_name}</div>
            {match.team2_score && <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--text)', marginTop: '8px' }}>{match.team2_score}</div>}
          </div>
        </div>

        {match.status === 'completed' && match.winner && (
          <div style={{ background: 'var(--green-dim)', border: '1px solid rgba(74,222,154,0.2)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: '13px', color: 'var(--green)', textAlign: 'center', marginBottom: '16px' }}>
            <span style={{ color: 'var(--text-3)' }}>Winner: </span>
            <strong>{match.winner?.full_name}</strong>
          </div>
        )}

        <div className="divider" />
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <div className="stat-label">Venue</div>
            <div style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '2px' }}>{match.venue}</div>
          </div>
          <div>
            <div className="stat-label">Date</div>
            <div style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '2px' }}>{formatDate(match.match_date)}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          {myBet && (
            <div className="card" style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>Your Bet</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: myBet.team?.color, display: 'inline-block' }} />
                    <span style={{ fontWeight: 500, color: 'var(--text)' }}>{myBet.team?.short_name}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                    Amount: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-2)' }}>{formatMoney(myBet.amount)}</span>
                  </div>
                  {myBet.status === 'won' && <div style={{ fontSize: '12px', color: 'var(--green)', marginTop: '2px' }}>Payout: {formatMoney(myBet.payout)}</div>}
                </div>
                <span className={`badge badge-${myBet.status}`}>{myBet.status}</span>
              </div>
            </div>
          )}

          {canBet && (
            <div className="card">
              <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>Place Bet</div>

              <div style={{ marginBottom: '14px' }}>
                <div className="form-label" style={{ marginBottom: '8px' }}>Pick a team</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[match.team1, match.team2].map((team) => (
                    <button key={team.id} className={`team-select-btn${selectedTeam === team.id ? ' selected' : ''}`}
                      onClick={() => setSelectedTeam(team.id)}
                      style={{ borderColor: selectedTeam === team.id ? team.color : undefined }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '2px', background: team.color, display: 'inline-block', marginRight: '6px' }} />
                      {team.short_name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label className="form-label">Amount</label>
                <input className="form-input" type="number" placeholder="₹ enter amount" value={amount}
                  onChange={(e) => setAmount(e.target.value)} min="1"
                  style={{ fontSize: '18px', fontFamily: 'var(--font-mono)', fontWeight: 500 }} />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <input type="range" min="0" max={SLIDER_MAX} step="50"
                  value={Math.min(parseFloat(amount) || 0, SLIDER_MAX)}
                  onChange={(e) => setAmount(String(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', height: '4px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>₹0</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>₹{SLIDER_MAX.toLocaleString('en-IN')}+</span>
                </div>
              </div>

              <div className="amount-presets" style={{ marginBottom: '14px' }}>
                {PRESETS.map((p) => (
                  <button key={p} className="preset-btn" onClick={() => setAmount(String(p))}>
                    ₹{p.toLocaleString('en-IN')}
                  </button>
                ))}
              </div>

              {amount && selectedTeam && (
                <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '12px', background: 'var(--bg-3)', padding: '8px 12px', borderRadius: '6px', lineHeight: '1.8' }}>
                  {opponentCount > 0 ? (
                    <>
                      Potential profit: <span style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{formatMoney(potentialProfit)}</span>
                      <span style={{ color: 'var(--text-3)', marginLeft: '6px' }}>({opponentCount} opponent{opponentCount !== 1 ? 's' : ''} × {formatMoney(parseFloat(amount || 0))})</span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-3)' }}>No opponents yet — you'd win nothing right now. Profit updates as others bet.</span>
                  )}
                </div>
              )}

              {betError && <div className="alert alert-error" style={{ marginBottom: '10px' }}>{betError}</div>}
              {betSuccess && <div className="alert alert-success" style={{ marginBottom: '10px' }}>{betSuccess}</div>}

              <button className="btn btn-primary btn-full" onClick={handlePlaceBet} disabled={betLoading || !selectedTeam || !amount}>
                {betLoading ? <><span className="spinner" style={{ borderTopColor: 'var(--bg)' }} />Placing...</> : 'Place Bet'}
              </button>
            </div>
          )}

          {match.status !== 'upcoming' && !myBet && (
            <div className="card">
              <div style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>Betting is closed for this match.</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card">
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>Betting Pool</div>
            {totalPool === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>No bets yet</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                  {[{ team: match.team1, pool: team1Pool }, { team: match.team2, pool: team2Pool }].map(({ team, pool }) => (
                    <div key={team.id} style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '2px', background: team.color, display: 'inline-block' }} />
                        <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{team.short_name}</span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', color: 'var(--text)', fontWeight: 500 }}>{formatMoney(pool)}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                        {totalPool > 0 ? Math.round(pool / totalPool * 100) : 0}% · {(pool > 0 ? (team.id === match.team1_id ? team1Bets : team2Bets) : []).length} bets
                      </div>
                      <div style={{ height: '3px', background: 'var(--bg-3)', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${totalPool > 0 ? pool / totalPool * 100 : 0}%`, background: team.color, borderRadius: '2px', transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>Total: {formatMoney(totalPool)}</div>
              </>
            )}
          </div>

          <div className="card">
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>All Bets ({bets.length})</div>
            {bets.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>No bets placed yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {bets.map((bet) => (
                  <div key={bet.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--bg-3)', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '2px', background: bet.team?.color, display: 'inline-block' }} />
                      <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>{bet.user?.display_name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-2)' }}>{formatMoney(bet.amount)}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{bet.team?.short_name}</span>
                      <span className={`badge badge-${bet.status}`}>{bet.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default MatchDetailPage;
