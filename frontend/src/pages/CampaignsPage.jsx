import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Plus, Trash2 } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const headers = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

const fetchCampaigns = async () => {
  const res = await fetch('/api/campaigns', { headers: headers() });
  if (!res.ok) throw new Error('Failed');
  const json = await res.json();
  return json.data || json;
};

const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' };
const btn = (variant = 'primary') => ({
  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
  background: variant === 'primary' ? 'var(--accent)' : variant === 'danger' ? 'var(--danger)' : 'var(--surface2)',
  color: variant === 'ghost' ? 'var(--text2)' : '#fff',
  border: '1px solid ' + (variant === 'ghost' ? 'var(--border)' : 'transparent'),
  borderRadius: 'var(--radius)', padding: '0.4rem 0.9rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
});

const statusBadge = (s) => {
  const colors = { active: 'var(--success)', draft: 'var(--text2)', paused: '#f59e0b', completed: '#3b82f6' };
  const c = colors[s] || 'var(--text2)';
  return { display: 'inline-block', background: c + '22', color: c, border: `1px solid ${c}44`, borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize' };
};

export default function CampaignsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading, error } = useQuery({ queryKey: ['campaigns'], queryFn: fetchCampaigns });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' });

  const addMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch('/api/campaigns', { method: 'POST', headers: headers(), body: JSON.stringify(data) });
      if (!res.ok) throw new Error('Failed to create');
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries(['campaigns']); setShowForm(false); setForm({ name: '', startDate: '', endDate: '' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE', headers: headers() });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => qc.invalidateQueries(['campaigns']),
  });

  const input = { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box' };

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Megaphone size={20} color="var(--accent)" />
          <h1 style={{ margin: 0, color: 'var(--text)', fontWeight: 700, fontSize: '1.4rem' }}>Campaigns</h1>
        </div>
        <button style={btn()} onClick={() => setShowForm(s => !s)}><Plus size={15} /> New Campaign</button>
      </div>

      {showForm && (
        <div style={{ ...card, marginBottom: '1.5rem' }}>
          <h3 style={{ color: 'var(--text)', margin: '0 0 1rem' }}>New Campaign</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <input style={input} placeholder="Campaign name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <input style={input} type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            <input style={input} type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button style={btn()} onClick={() => addMutation.mutate(form)} disabled={!form.name || addMutation.isPending}>{addMutation.isPending ? 'Saving…' : 'Save'}</button>
            <button style={btn('ghost')} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {isLoading && <div style={{ color: 'var(--text2)' }}>Loading…</div>}
      {error && <div style={{ color: 'var(--danger)' }}>{error.message}</div>}

      <div style={card}>
        {data.length === 0 && !isLoading ? <div style={{ color: 'var(--text2)' }}>No campaigns yet.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Name', 'Status', 'Start Date', 'End Date', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text2)', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.map((c, i) => (
                <tr key={c.id ?? i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text)', fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: '0.65rem 0.75rem' }}><span style={statusBadge(c.status || 'draft')}>{c.status || 'draft'}</span></td>
                  <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text2)', fontSize: '0.85rem' }}>{c.startDate || c.start_date || '—'}</td>
                  <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text2)', fontSize: '0.85rem' }}>{c.endDate || c.end_date || '—'}</td>
                  <td style={{ padding: '0.65rem 0.75rem' }}>
                    <button style={{ ...btn('danger'), padding: '0.3rem 0.5rem' }} onClick={() => deleteMutation.mutate(c.id)}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
