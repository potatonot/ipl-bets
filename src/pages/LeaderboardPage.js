import React, { useEffect, useState } from 'react';
import { getLeaderboard } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { getCache, setCache } from '../lib/cache';

const CACHE_KEY = 'leaderboard';

const fmt = (n) => {
  const num = Number(n);
  const str = Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return (num >= 0 ? '+₹' : '-₹') + str;
};
const fmtMoney = (n) => `₹${Math.abs(Number(n)).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const RankBadge = ({ rank }) => {
  const emojis = { 1: '🥇', 2: '🥈', 3: '🥉' };
  if (emojis[rank]) return <span style={{ fontSize: '16px' }}>{emojis[rank]}</span>;
  return <span className="rank">{rank}</span>;
};

const WinRateBar = ({ rate }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <div style={{ flex: 1, height: '3px', background: 'var(--bg-3)', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${rate}%`,
        background: rate >= 60 ? 'var(--green)' : rate >= 40 ? 'var(--accent)' : 'var(--red)',
        borderRadius: '2px',
      }} />
    </div>
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', width: '32px', textAlign: 'right' }}>
      {rate}%
    </span>
  </div>
);

const LeaderboardPage = () => {
  const { profile: myProfile } = useAuth();
  const [data, setData] = useState(() => getCache(CACHE_KEY) || []);
  const [loading, setLoading] = useState(data.length === 0);

  const fetchData = (silent = false) => {
    if (!silent) setLoading(true);
    getLeaderboard().then(({ data: d }) => {
      if (d) { setData(d); setCache(CACHE_KEY, d); }
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData(data.length > 0);
    // Auto-refresh every 30s — silently, no spinner
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const myRank = data.findIndex((d) => d.id === myProfile?.id) + 1;

  return (
    <main className="page-content">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <h1>Leaderboard</h1>
            <p>Live standings · refreshes every 30s</p>
          </div>
          {myRank > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Your rank</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', color: 'var(--accent)', fontWeight: 500 }}>#{myRank}</div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loader"><div className="spinner" />Loading...</div>
      ) : data.length === 0 ? (
        <div className="empty">No players yet.</div>
      ) : (
        <>
          {data.length >= 3 && (
            <div className="grid-3" style={{ marginBottom: '24px' }}>
              {[data[1], data[0], data[2]].map((player, i) => {
                const rank = i === 0 ? 2 : i === 1 ? 1 : 3;
                const isMe = player?.id === myProfile?.id;
                return player ? (
                  <div key={player.id} className="card" style={{
                    textAlign: 'center',
                    border: isMe ? '1px solid var(--accent)' : undefined,
                    transform: rank === 1 ? 'none' : 'scale(0.97)',
                    opacity: rank === 1 ? 1 : 0.85,
                  }}>
                    <div style={{ fontSize: '20px', marginBottom: '8px' }}>
                      {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
                    </div>
                    <div style={{ fontWeight: 500, color: 'var(--text)', marginBottom: '4px' }}>
                      {player.display_name}
                      {isMe && <span style={{ fontSize: '10px', color: 'var(--accent)', marginLeft: '6px' }}>you</span>}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', color: Number(player.net_profit) >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>
                      {fmt(player.net_profit)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>{player.win_rate}% win rate</div>
                  </div>
                ) : <div key={i} />;
              })}
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Player</th>
                  <th className="td-right">Net P&L</th>
                  <th className="td-right">Wagered</th>
                  <th>Win Rate</th>
                  <th className="td-right">Bets</th>
                  <th className="td-right">W / L</th>
                </tr>
              </thead>
              <tbody>
                {data.map((player, index) => {
                  const rank = index + 1;
                  const isMe = player.id === myProfile?.id;
                  const profit = Number(player.net_profit);
                  return (
                    <tr key={player.id} style={{ background: isMe ? 'rgba(232,255,71,0.03)' : undefined }}>
                      <td><RankBadge rank={rank} /></td>
                      <td className="td-primary">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {player.display_name}
                          {isMe && <span style={{ fontSize: '10px', background: 'var(--accent-dim)', color: 'var(--accent)', padding: '2px 6px', borderRadius: '4px', fontWeight: 500 }}>you</span>}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>@{player.username}</div>
                      </td>
                      <td className="td-right td-mono" style={{ color: profit >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>
                        {fmt(player.net_profit)}
                      </td>
                      <td className="td-right td-mono">{fmtMoney(player.total_wagered)}</td>
                      <td style={{ minWidth: '120px' }}>
                        {player.total_bets > 0 ? <WinRateBar rate={Number(player.win_rate)} /> : <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>No bets</span>}
                      </td>
                      <td className="td-right td-mono">{player.total_bets}</td>
                      <td className="td-right td-mono" style={{ fontSize: '12px' }}>
                        <span style={{ color: 'var(--green)' }}>{player.bets_won}</span>
                        <span style={{ color: 'var(--text-3)' }}> / </span>
                        <span style={{ color: 'var(--red)' }}>{player.bets_lost}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
};

export default LeaderboardPage;
