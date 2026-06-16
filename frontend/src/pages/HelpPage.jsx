import { BookOpen, Layers, FileText, Bot, Radio, MessageSquare, Mail, Info } from 'lucide-react'

const GUIDES = [
  {
    icon: Layers,
    title: 'Sets — post to a group of accounts in one click',
    what: "A Set is a saved group of accounts, so you don't have to tick the same platforms every time you post.",
    steps: [
      'Open Sets from the sidebar.',
      'Pick the Site at the top, then click "Create Set".',
      'Name it (e.g. "All Ministry Platforms") and tick the accounts to include.',
      'Click "Save Set".',
      'In Compose, pick the site, then choose your Set from the "Use a Set…" dropdown — every account in that Set is selected at once.',
    ],
    tips: ["A Set only selects accounts that belong to the site you're composing for."],
  },
  {
    icon: FileText,
    title: 'Blog to Social — turn one article into posts for every platform',
    what: 'Paste a blog link (or article text) and AI writes a post tailored to each platform you pick.',
    steps: [
      'Open Blog to Social.',
      'Paste a blog/article URL, or paste the title + content directly.',
      '(Optional) choose a Voice Profile to match your tone.',
      'Tap the platform pills to choose which networks to write for.',
      'Click "Generate Posts" — a custom post appears for each platform.',
      'Click "Compose" on any post to drop it straight into the Composer (then pick accounts and schedule), or "Copy" to paste it elsewhere.',
    ],
  },
  {
    icon: Bot,
    title: 'AI Auto-Posting — let AI write and post for you automatically',
    what: 'Set a topic once and AI writes and publishes fresh posts on the schedule you choose.',
    steps: [
      'Open "AI Auto Post" (AI Auto-Schedule).',
      'Click "New AI Schedule".',
      'Name it, pick the Site, and write the Topic — the more specific, the more on-brand (e.g. "daily homecare wellness tips for families and caregivers").',
      'Choose a Tone and Frequency (e.g. Twice Daily).',
      'Tick the accounts to post to. Toggle "Generate AI image" if you want an image on every post.',
      'Click Create. Use "Run Now" to test it, and the ▶ / ⏸ buttons to activate or pause.',
    ],
    tips: [
      'Every post is different — the AI is told to avoid repeating your recent posts.',
      'YouTube and TikTok require a video, so they can\'t be used for text/image auto-posts.',
      'Instagram requires an image — turn on "Generate AI image" if you include an Instagram account.',
    ],
  },
  {
    icon: Radio,
    title: 'WhatsApp Broadcast & Templates',
    what: 'Send a WhatsApp message to a segment of contacts. Templates let you reach people even OUTSIDE the 24-hour window.',
    steps: [
      'Open Broadcast.',
      'Pick the Site, the WhatsApp connection, and the Segment to send to.',
      'Regular message: type your text (or attach media) and Send — this only reaches people who messaged you in the last 24 hours.',
      'Template mode: switch the toggle to "Template", choose an approved template, fill in its fields, and Send — this reaches everyone, anytime.',
    ],
    tips: ['Only Meta-approved templates can be sent. A new template takes a little while to get approved.'],
  },
  {
    icon: MessageSquare,
    title: 'Inbox — every message, in and out, with media',
    what: 'See incoming and outgoing messages across your channels, including photos, videos and voice notes.',
    steps: [
      'Open Inbox and filter by channel (e.g. WhatsApp).',
      'Incoming media shows inline; your own sent messages show a green "↗ Sent" badge.',
      'Click "Reply" on an incoming message to respond right there.',
    ],
  },
  {
    icon: Mail,
    title: 'Email Inbox — Gmail & Outlook in one place',
    what: 'Read and reply to all your email accounts from inside FlomiPost.',
    steps: [
      'Open Email Inbox.',
      'Use the account chips to filter, or add more accounts with the accounts button.',
      'Click an email to read it (links open in your browser). Reply with attachments, or select many at once to mark read / delete.',
    ],
  },
]

export default function HelpPage() {
  return (
    <div>
      <div className="fp-page-header" style={{ marginBottom: 20 }}>
        <h1 className="fp-page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={22} /> Help &amp; Guides
        </h1>
        <p className="fp-page-sub">Short, step-by-step how-tos for FlomiPost's main features.</p>
      </div>

      {/* Good-to-know note */}
      <div className="fp-card" style={{ marginBottom: 16, borderLeft: '4px solid var(--violet)', display: 'flex', gap: 10 }}>
        <Info size={18} style={{ color: 'var(--violet)', flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          <strong>Good to know:</strong> You can post to Facebook <em>Pages</em> but not personal Facebook
          <em> profiles</em> — Meta blocks every app from doing that. Instagram needs an image on each post,
          and YouTube/TikTok need a video. FlomiPost handles everything Meta and each platform allow.
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        {GUIDES.map((g, i) => {
          const Icon = g.icon
          return (
            <div key={i} className="fp-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--violet)15',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} style={{ color: 'var(--violet)' }} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{g.title}</div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10, lineHeight: 1.6 }}>{g.what}</div>
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text1)', lineHeight: 1.8 }}>
                {g.steps.map((s, j) => <li key={j}>{s}</li>)}
              </ol>
              {g.tips && g.tips.length > 0 && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--bg2)', borderRadius: 8 }}>
                  {g.tips.map((t, k) => (
                    <div key={k} style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>💡 {t}</div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
