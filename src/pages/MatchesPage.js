import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getMatches, getUserBets } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { getCache, setCache } from '../lib/cache';

const MATCHES_KEY = 'matches';
const BETS_KEY = (uid) => `bets_${uid}`;

const TeamDot = ({ color }) => (
  <span className="team-dot" style={{ background: color }} />
);

const MatchCard = ({ match, userBet }) => {
  const now = new Date();
  const matchDate = new Date(match.match_date);
  const isToday = matchDate.toDateString() === now.toDateString();
  const isTomorrow = new Date(now.getTime() + 86400000).toDateString() === matchDate.toDateString();

  const formatDate = (d) => {
    if (isToday) return `Today · ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
    if (isTomorrow) return `Tomorrow · ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' · ' +
      d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const statusClass = {
    upcoming: 'badge-upcoming',
    live: 'badge-live',
    completed: 'badge-completed',
    abandoned: 'badge-abandoned',
  }[match.status] || 'badge-upcoming';

  return (
    <Link to={`/matches/${match.id}`} style={{ display: 'block' }}>
      <div className="match-card">
        <div className="match-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`badge ${statusClass}`}>{match.status}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              M{match.match_number} · {match.match_type.toUpperCase()}
            </span>
          </div>
          {userBet && (
            <span className={`badge badge-${userBet.status}`}>
              {userBet.status === 'pending' ? `Bet ₹${userBet.amount}` : userBet.status}
            </span>
          )}
        </div>

        <div className="match-teams">
          <div className="team-chip">
            <TeamDot color={match.team1?.color} />
            <span className="team-name">{match.team1?.short_name}</span>
            {match.team1_score && <span className="team-score">{match.team1_score}</span>}
          </div>
          <span className="vs-divider">vs</span>
          <div className="team-chip" style={{ justifyContent: 'flex-end' }}>
            {match.team2_score && <span className="team-score">{match.team2_score}</span>}
            <span className="team-name">{match.team2?.short_name}</span>
            <TeamDot color={match.team2?.color} />
          </div>
        </div>

        {match.status === 'completed' && match.winner && (
          <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-3)' }}>Winner:</span>
            <TeamDot color={match.winner?.color} />
            {match.winner?.full_name}
          </div>
        )}

        <div className="match-footer">
          <span className="match-venue">{match.venue.split(',')[0]}</span>
          <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{formatDate(matchDate)}</span>
        </div>
      </div>
    </Link>
  );
};

const MatchesPage = () => {
  const { user } = useAuth();

  // Seed state from cache immediately — no waiting
  const [matches, setMatches] = useState(() => getCache(MATCHES_KEY) || []);
  const [userBets, setUserBets] = useState(() => {
    const cached = getCache(BETS_KEY(user?.id));
    if (!cached) return {};
    const map = {};
    cached.forEach((b) => { map[b.match_id] = b; });
    return map;
  });
  const [loading, setLoading] = useState(matches.length === 0);
  const [filter, setFilter] = useState('all');

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [{ data: m }, { data: b }] = await Promise.all([
      getMatches(),
      getUserBets(user.id),
    ]);
    if (m) { setMatches(m); setCache(MATCHES_KEY, m); }
    if (b) {
      const map = {};
      b.forEach((bet) => { map[bet.match_id] = bet; });
      setUserBets(map);
      setCache(BETS_KEY(user.id), b);
    }
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    // Cache hit: show instantly, refresh silently in background
    // Cache miss: show spinner, fetch, then display
    fetchData(matches.length > 0);
  }, []);

  const filtered = matches.filter((m) => filter === 'all' || m.status === filter);
  const counts = {
    all: matches.length,
    upcoming: matches.filter((m) => m.status === 'upcoming').length,
    live: matches.filter((m) => m.status === 'live').length,
    completed: matches.filter((m) => m.status === 'completed').length,
  };

  return (
    <main className="page-content">
      <div className="page-header" style={{ paddingBottom: '0', borderBottom: 'none', marginBottom: '0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h1>IPL 2026</h1>
            <p>84 matches · 10 teams · 28 Mar – 31 May</p>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            {counts.upcoming} upcoming
          </div>
        </div>
      </div>

      <div className="tabs" style={{ marginTop: '0' }}>
        {['all', 'upcoming', 'live', 'completed'].map((f) => (
          <button
            key={f}
            className={`tab${filter === f ? ' active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span style={{ marginLeft: '6px', color: 'var(--text-3)', fontSize: '11px' }}>{counts[f]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loader"><div className="spinner" />Loading matches...</div>
      ) : filtered.length === 0 ? (
        <div className="empty">No {filter} matches found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map((match) => (
            <MatchCard key={match.id} match={match} userBet={userBets[match.id]} />
          ))}
        </div>
      )}
    </main>
  );
};

export default MatchesPage;
