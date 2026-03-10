import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getUserBets, getUserTransactions } from '../lib/supabase';
import { getCache, setCache } from '../lib/cache';

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });

const StatCard = ({ label, value, sub, color }) => (
  <div className="card-sm">
    <div className="stat-label">{label}</div>
    <div className="stat-value" style={{ color: color || 'var(--text)', fontSize: '18px', marginTop: '4px' }}>{value}</div>
    {sub && <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>{sub}</div>}
  </div>
);

const ProfilePage = () => {
  const { profile } = useAuth();
  const BETS_KEY = `profile_bets_${profile?.id}`;
  const TX_KEY = `profile_tx_${profile?.id}`;

  const [bets, setBets] = useState(() => getCache(BETS_KEY) || []);
  const [transactions, setTransactions] = useState(() => getCache(TX_KEY) || []);
  const [loading, setLoading] = useState(bets.length === 0);
  const [tab, setTab] = useState('bets');

  useEffect(() => {
    if (!profile) return;
    const silent = bets.length > 0;
    if (!silent) setLoading(true);
    Promise.all([getUserBets(profile.id), getUserTransactions(profile.id)]).then(
      ([{ data: b }, { data: t }]) => {
        if (b) { setBets(b); setCache(BETS_KEY, b); }
        if (t) { setTransactions(t); setCache(TX_KEY, t); }
        setLoading(false);
      }
    );
  }, [profile?.id]);

  if (!profile) return <main className="page-content"><div className="loader"><div className="spinner" /></div></main>;

  const settled = bets.filter((b) => b.status !== 'pending');
  const won = bets.filter((b) => b.status === 'won');
  const pending = bets.filter((b) => b.status === 'pending');
  const winRate = settled.length > 0 ? ((won.length / settled.length) * 100).toFixed(1) : '—';
  const totalWagered = bets.reduce((s, b) => s + Number(b.amount), 0);
  const totalWon = won.reduce((s, b) => s + Number(b.payout || 0), 0);
  const netProfit = totalWon - totalWagered;

  return (
    <main className="page-content">
      <div className="page-header">
        <h1>{profile.display_name}</h1>
        <p>@{profile.username}</p>
      </div>

      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <StatCard
          label="Net P&L"
          value={(netProfit >= 0 ? '+' : '') + fmt(netProfit)}
          color={netProfit >= 0 ? 'var(--green)' : 'var(--red)'}
        />
        <StatCard
          label="Win Rate"
          value={winRate === '—' ? '—' : `${winRate}%`}
          sub={`${won.length}W / ${settled.length - won.length}L`}
          color={parseFloat(winRate) >= 50 ? 'var(--green)' : winRate === '—' ? 'var(--text)' : 'var(--red)'}
        />
        <StatCard label="Total Bets" value={bets.length} sub={`${pending.length} pending`} />
        <StatCard label="Total Wagered" value={fmt(totalWagered)} />
      </div>

      <div className="grid-4" style={{ marginBottom: '28px' }}>
        <StatCard label="Total Won" value={fmt(totalWon)} color="var(--green)" />
        <StatCard label="Bets Won" value={won.length} />
        <StatCard label="Bets Lost" value={settled.length - won.length} color={settled.length - won.length > 0 ? 'var(--red)' : 'var(--text)'} />
        <StatCard label="Biggest Bet" value={bets.length ? fmt(Math.max(...bets.map((b) => Number(b.amount)))) : '—'} />
      </div>

      <div className="tabs">
        <button className={`tab${tab === 'bets' ? ' active' : ''}`} onClick={() => setTab('bets')}>
          Bet History <span style={{ color: 'var(--text-3)', fontSize: '11px', marginLeft: '4px' }}>{bets.length}</span>
        </button>
        <button className={`tab${tab === 'transactions' ? ' active' : ''}`} onClick={() => setTab('transactions')}>
          Transactions <span style={{ color: 'var(--text-3)', fontSize: '11px', marginLeft: '4px' }}>{transactions.length}</span>
        </button>
      </div>

      {loading ? (
        <div className="loader"><div className="spinner" />Loading...</div>
      ) : tab === 'bets' ? (
        bets.length === 0 ? (
          <div className="empty">No bets placed yet. Head to <strong>Matches</strong> to start.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Bet on</th>
                  <th className="td-right">Amount</th>
                  <th className="td-right">Payout</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {bets.map((bet) => (
                  <tr key={bet.id}>
                    <td className="td-primary">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '2px', background: bet.match?.team1?.color, display: 'inline-block' }} />
                        {bet.match?.team1?.short_name}
                        <span style={{ color: 'var(--text-3)' }}>vs</span>
                        {bet.match?.team2?.short_name}
                        <span style={{ width: '6px', height: '6px', borderRadius: '2px', background: bet.match?.team2?.color, display: 'inline-block' }} />
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '2px', background: bet.team?.color, display: 'inline-block' }} />
                        <span style={{ color: 'var(--text-2)' }}>{bet.team?.short_name}</span>
                      </div>
                    </td>
                    <td className="td-right td-mono">{fmt(bet.amount)}</td>
                    <td className="td-right td-mono" style={{ color: bet.status === 'won' ? 'var(--green)' : 'var(--text-3)' }}>
                      {bet.status === 'won' ? fmt(bet.payout) : '—'}
                    </td>
                    <td><span className={`badge badge-${bet.status}`}>{bet.status}</span></td>
                    <td style={{ color: 'var(--text-3)', fontSize: '12px' }}>{fmtDate(bet.placed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        transactions.length === 0 ? (
          <div className="empty">No transactions yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Description</th>
                  <th className="td-right">Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <span className={`badge ${tx.amount >= 0 ? 'badge-won' : 'badge-lost'}`}>
                        {tx.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{tx.description || '—'}</td>
                    <td className="td-right td-mono" style={{ color: tx.amount >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {tx.amount >= 0 ? '+' : ''}{fmt(Math.abs(tx.amount))}
                    </td>
                    <td style={{ color: 'var(--text-3)', fontSize: '12px' }}>{fmtDate(tx.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </main>
  );
};

export default ProfilePage;
