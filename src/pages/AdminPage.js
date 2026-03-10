import React, { useEffect, useState } from 'react';
import { getMatches, settleMatch, supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const AdminPage = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(null);
  const [feedback, setFeedback] = useState({});

  // Settle form state
  const [settleForm, setSettleForm] = useState({});

  const [profiles, setProfiles] = useState([]);
  const [adjustForm, setAdjustForm] = useState({ userId: '', amount: '', reason: '' });
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustMsg, setAdjustMsg] = useState('');

  // Add match form
  const [addMatch, setAddMatch] = useState({ team1_id: '', team2_id: '', match_date: '', venue: '', match_number: '', match_type: 'league' });
  const [addLoading, setAddLoading] = useState(false);
  const [addMsg, setAddMsg] = useState('');
  const [teams, setTeams] = useState([]);

  const [tab, setTab] = useState('settle');

  useEffect(() => {
    const load = async () => {
      const [{ data: m }, { data: p }, { data: t }] = await Promise.all([
        getMatches(),
        supabase.from('profiles').select('*').order('username', { ascending: true }),
        supabase.from('teams').select('*').order('short_name'),
      ]);
      if (m) setMatches(m.filter((x) => x.status !== 'completed' && x.status !== 'abandoned'));
      if (p) setProfiles(p.data || p);
      if (t) setTeams(t.data || t);
      setLoading(false);
    };
    load();
  }, []);

  const handleSettle = async (matchId) => {
    const form = settleForm[matchId];
    if (!form?.winnerId) return setFeedback({ [matchId]: { error: 'Select a winner' } });

    setSettling(matchId);
    const { error } = await settleMatch(
      matchId, parseInt(form.winnerId), form.team1Score || null, form.team2Score || null
    );
    if (error) {
      setFeedback({ [matchId]: { error: error.message } });
    } else {
      setFeedback({ [matchId]: { success: 'Match settled! Bets have been resolved.' } });
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
    }
    setSettling(null);
  };

  const setFormField = (matchId, key, val) => {
    setSettleForm((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], [key]: val },
    }));
  };

  const handleAdjust = async () => {
    if (!adjustForm.userId || !adjustForm.reason) return;
    setAdjustLoading(true);
    setAdjustMsg('');
    const profile = profiles.find((p) => p.id === adjustForm.userId);
    if (!profile) { setAdjustMsg('User not found'); setAdjustLoading(false); return; }
    const { error } = await supabase.from('transactions').insert({
      user_id: adjustForm.userId,
      type: 'admin_adjust',
      amount: 0,
      balance_after: 0,
      description: adjustForm.reason,
    });
    if (!error) {
      setAdjustMsg(`✓ Note logged for ${profile.display_name}`);
      setAdjustForm({ userId: '', reason: '' });
    } else {
      setAdjustMsg(error.message);
    }
    setAdjustLoading(false);
  };

  const handleAddMatch = async () => {
    setAddLoading(true);
    setAddMsg('');
    const { error } = await supabase.from('matches').insert({
      match_number: parseInt(addMatch.match_number),
      team1_id: parseInt(addMatch.team1_id),
      team2_id: parseInt(addMatch.team2_id),
      venue: addMatch.venue,
      match_date: new Date(addMatch.match_date).toISOString(),
      match_type: addMatch.match_type,
      status: 'upcoming',
    });
    if (error) setAddMsg(error.message);
    else {
      setAddMsg('✓ Match added!');
      setAddMatch({ team1_id: '', team2_id: '', match_date: '', venue: '', match_number: '', match_type: 'league' });
      const { data: m } = await getMatches();
      if (m) setMatches(m.filter((x) => x.status !== 'completed' && x.status !== 'abandoned'));
    }
    setAddLoading(false);
  };

  const handleMarkLive = async (matchId) => {
    await supabase.from('matches').update({ status: 'live' }).eq('id', matchId);
    setMatches((prev) => prev.map((m) => m.id === matchId ? { ...m, status: 'live' } : m));
  };

  return (
    <main className="page-content">
      <div className="page-header">
        <h1>Admin Panel</h1>
        <p>Settle matches, manage balances, add fixtures</p>
      </div>

      <div className="tabs">
        <button className={`tab${tab === 'settle' ? ' active' : ''}`} onClick={() => setTab('settle')}>Settle Matches</button>
        <button className={`tab${tab === 'balances' ? ' active' : ''}`} onClick={() => setTab('balances')}>Manage Balances</button>
        <button className={`tab${tab === 'addmatch' ? ' active' : ''}`} onClick={() => setTab('addmatch')}>Add Match</button>
      </div>

      {loading ? (
        <div className="loader"><div className="spinner" />Loading...</div>
      ) : tab === 'settle' ? (
        <>
          <div className="alert alert-info" style={{ marginBottom: '20px' }}>
            Settling a match automatically credits winners (2× payout) and marks losing bets as lost.
          </div>

          {matches.length === 0 ? (
            <div className="empty">No pending matches to settle.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {matches.map((match) => {
                const fb = feedback[match.id];
                const form = settleForm[match.id] || {};
                return (
                  <div key={match.id} className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <span className={`badge badge-${match.status}`}>{match.status}</span>
                      <span style={{ fontWeight: 500, color: 'var(--text)' }}>
                        M{match.match_number} · {match.team1?.short_name} vs {match.team2?.short_name}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-3)', marginLeft: 'auto' }}>
                        {new Date(match.match_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                      <div className="form-group">
                        <label className="form-label">{match.team1?.short_name} Score</label>
                        <input className="form-input" placeholder="e.g. 185/4 (20)" value={form.team1Score || ''} onChange={(e) => setFormField(match.id, 'team1Score', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{match.team2?.short_name} Score</label>
                        <input className="form-input" placeholder="e.g. 179/6 (20)" value={form.team2Score || ''} onChange={(e) => setFormField(match.id, 'team2Score', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Winner</label>
                        <select
                          className="form-input"
                          value={form.winnerId || ''}
                          onChange={(e) => setFormField(match.id, 'winnerId', e.target.value)}
                        >
                          <option value="">— Select —</option>
                          <option value={match.team1_id}>{match.team1?.full_name}</option>
                          <option value={match.team2_id}>{match.team2?.full_name}</option>
                          <option value="abandoned">Abandoned (refund)</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {match.status === 'upcoming' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleMarkLive(match.id)}>
                            Mark Live
                          </button>
                        )}
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSettle(match.id)}
                          disabled={settling === match.id}
                        >
                          {settling === match.id ? 'Settling...' : 'Settle'}
                        </button>
                      </div>
                    </div>

                    {fb?.error && <div className="alert alert-error" style={{ marginTop: '10px' }}>{fb.error}</div>}
                    {fb?.success && <div className="alert alert-success" style={{ marginTop: '10px' }}>{fb.success}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : tab === 'balances' ? (
        <>
          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginBottom: '16px' }}>Log a Note for a Player</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '10px', alignItems: 'end' }}>
              <div className="form-group">
                <label className="form-label">Player</label>
                <select className="form-input" value={adjustForm.userId} onChange={(e) => setAdjustForm({ ...adjustForm, userId: e.target.value })}>
                  <option value="">— Select —</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.display_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Note</label>
                <input className="form-input" placeholder="e.g. settled outside the app" value={adjustForm.reason || ''} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} />
              </div>
              <button className="btn btn-primary" onClick={handleAdjust} disabled={adjustLoading}>
                {adjustLoading ? 'Saving...' : 'Log'}
              </button>
            </div>
            {adjustMsg && <div className={`alert ${adjustMsg.startsWith('✓') ? 'alert-success' : 'alert-error'}`} style={{ marginTop: '12px' }}>{adjustMsg}</div>}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Username</th>
                  <th>Member since</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id}>
                    <td className="td-primary">{p.display_name}</td>
                    <td style={{ color: 'var(--text-3)' }}>@{p.username}</td>
                    <td style={{ color: 'var(--text-3)', fontSize: '12px' }}>
                      {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="card" style={{ maxWidth: '540px' }}>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginBottom: '16px' }}>Add New Match</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Match #</label>
                <input className="form-input" type="number" placeholder="21" value={addMatch.match_number} onChange={(e) => setAddMatch({ ...addMatch, match_number: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-input" value={addMatch.match_type} onChange={(e) => setAddMatch({ ...addMatch, match_type: e.target.value })}>
                  <option value="league">League</option>
                  <option value="qualifier1">Qualifier 1</option>
                  <option value="eliminator">Eliminator</option>
                  <option value="qualifier2">Qualifier 2</option>
                  <option value="final">Final</option>
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Team 1</label>
                <select className="form-input" value={addMatch.team1_id} onChange={(e) => setAddMatch({ ...addMatch, team1_id: e.target.value })}>
                  <option value="">— Select —</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.short_name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Team 2</label>
                <select className="form-input" value={addMatch.team2_id} onChange={(e) => setAddMatch({ ...addMatch, team2_id: e.target.value })}>
                  <option value="">— Select —</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.short_name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Venue</label>
              <input className="form-input" placeholder="Stadium, City" value={addMatch.venue} onChange={(e) => setAddMatch({ ...addMatch, venue: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Date & Time (IST)</label>
              <input className="form-input" type="datetime-local" value={addMatch.match_date} onChange={(e) => setAddMatch({ ...addMatch, match_date: e.target.value })} />
            </div>
            {addMsg && <div className={`alert ${addMsg.startsWith('✓') ? 'alert-success' : 'alert-error'}`}>{addMsg}</div>}
            <button className="btn btn-primary" onClick={handleAddMatch} disabled={addLoading}>
              {addLoading ? 'Adding...' : 'Add Match'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
};

export default AdminPage;
