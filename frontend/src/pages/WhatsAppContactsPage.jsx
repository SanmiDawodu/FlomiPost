import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { Users, Upload } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const headers = () => ({ Authorization: `Bearer ${token()}` });

export default function WhatsAppContactsPage() {
  const fileRef = useRef(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ['wa-contacts'],
    queryFn: async () => {
      const r = await fetch('/api/whatsapp/contacts', { headers: headers() });
      if (!r.ok) throw new Error('Failed to fetch contacts');
      const j = await r.json(); return j.data || j;
    },
  });

  const handleImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    await fetch('/api/whatsapp/contacts/import', { method: 'POST', headers: headers(), body: fd });
    alert('Import submitted');
  };

  const page = { padding: '2rem', maxWidth: '960px' };
  const table = { width: '100%', borderCollapse: 'collapse', marginTop: '1rem' };
  const th = { textAlign: 'left', padding: '0.75rem 1rem', background: 'var(--surface)', color: 'var(--text2)', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--border)' };
  const td = { padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.85rem' };
  const btn = { padding: '0.4rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--accent)', color: 'var(--text)', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' };

  return (
    <div style={page}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={22} /> WhatsApp Contacts</h1>
        <button style={btn} onClick={() => fileRef.current?.click()}><Upload size={15} /> Import CSV</button>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
      </div>
      {isLoading && <p style={{ color: 'var(--text2)' }}>Loading…</p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error.message}</p>}
      <table style={table}>
        <thead><tr><th style={th}>Name</th><th style={th}>Phone</th><th style={th}>Segment</th><th style={th}>Added</th></tr></thead>
        <tbody>
          {data?.map(c => (
            <tr key={c.id}>
              <td style={td}>{c.name}</td>
              <td style={td}>{c.phone}</td>
              <td style={td}>{c.segment || '—'}</td>
              <td style={td}>{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
            </tr>
          ))}
          {data?.length === 0 && <tr><td colSpan={4} style={{ ...td, color: 'var(--text2)', textAlign: 'center' }}>No contacts found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
