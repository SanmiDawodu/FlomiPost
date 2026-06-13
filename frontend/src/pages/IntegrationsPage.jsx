import { Puzzle, ExternalLink } from 'lucide-react';

const INTEGRATIONS = [
  { name: 'Zapier', desc: 'Connect FlomiPost to 5000+ apps via Zapier automations.', color: '#FF4A00', href: 'https://zapier.com' },
  { name: 'n8n', desc: 'Open-source workflow automation with n8n nodes.', color: '#EA4B71', href: 'https://n8n.io' },
  { name: 'Canva', desc: 'Design beautiful social graphics directly in Canva.', color: '#00C4CC', href: 'https://canva.com' },
  { name: 'Google Analytics', desc: 'Track link clicks and social traffic in GA4.', color: '#E37400', href: 'https://analytics.google.com' },
  { name: 'Mailchimp', desc: 'Sync leads and audiences with Mailchimp lists.', color: '#FFE01B', href: 'https://mailchimp.com' },
  { name: 'Slack', desc: 'Get post and approval notifications in Slack.', color: '#4A154B', href: 'https://slack.com' },
  { name: 'Webhook', desc: 'Send real-time events to any URL via HTTP webhooks.', color: 'var(--accent)', href: '/webhooks' },
];

export default function IntegrationsPage() {
  const page = { padding: '2rem', maxWidth: '1000px' };
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem', marginTop: '1.5rem' };
  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' };
  const dot = (color) => ({ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 });
  const btn = { padding: '0.45rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' };

  return (
    <div style={page}>
      <h1 style={{ color: 'var(--text)', margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Puzzle size={22} /> Integrations</h1>
      <p style={{ color: 'var(--text2)', margin: 0, fontSize: '0.9rem' }}>Connect FlomiPost with your favorite tools and services.</p>
      <div style={grid}>
        {INTEGRATIONS.map(int => (
          <div key={int.name} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={dot(int.color)} />
              <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem' }}>{int.name}</span>
            </div>
            <p style={{ color: 'var(--text2)', fontSize: '0.83rem', margin: 0, lineHeight: 1.5 }}>{int.desc}</p>
            <a href={int.href} target="_blank" rel="noopener noreferrer" style={btn}>
              <ExternalLink size={13} /> Connect
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
