import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Zap, LayoutDashboard, CalendarDays, PenLine, FileText, Clock, BarChart2,
  Inbox, Megaphone, LineChart, Mail, Radio, TrendingUp, Link2, Globe, Image,
  Copy, Layers, Tag, Rss, Repeat, RefreshCw, Sparkles, BookOpen,
  GalleryHorizontal, Mic, MessageSquare, Magnet, Send, Users, CheckSquare,
  UsersRound, UserCog, PenTool, Puzzle, Webhook, CheckCircle, Upload,
  Activity, Settings, LogOut
} from 'lucide-react';
import useAuthStore from '../store/authStore';

const navGroups = [
  {
    label: 'Overview',
    links: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/calendar', label: 'Calendar', icon: CalendarDays },
    ],
  },
  {
    label: 'Publishing',
    links: [
      { path: '/compose', label: 'New Post', icon: PenLine },
      { path: '/posts', label: 'Posts', icon: FileText },
      { path: '/queue', label: 'Queue', icon: Clock },
      { path: '/analytics', label: 'Analytics', icon: BarChart2 },
    ],
  },
  {
    label: 'Engagement',
    links: [
      { path: '/inbox', label: 'Inbox', icon: Inbox },
      { path: '/campaigns', label: 'Campaigns', icon: Megaphone },
      { path: '/reports', label: 'Reports', icon: LineChart },
      { path: '/email', label: 'Email', icon: Mail },
      { path: '/listening', label: 'Listening', icon: Radio },
    ],
  },
  {
    label: 'Insights',
    links: [
      { path: '/ga-analytics', label: 'GA Analytics', icon: TrendingUp },
      { path: '/connections', label: 'Connections', icon: Link2 },
      { path: '/sites', label: 'Sites', icon: Globe },
    ],
  },
  {
    label: 'Content',
    links: [
      { path: '/media', label: 'Media Library', icon: Image },
      { path: '/templates', label: 'Templates', icon: Copy },
      { path: '/sets', label: 'Content Sets', icon: Layers },
      { path: '/labels', label: 'Labels', icon: Tag },
      { path: '/rss-feeds', label: 'RSS Feeds', icon: Rss },
    ],
  },
  {
    label: 'Automation',
    links: [
      { path: '/auto-post', label: 'Auto Post', icon: Repeat },
      { path: '/recycle', label: 'Recycle', icon: RefreshCw },
      { path: '/ai-schedule', label: 'AI Schedule', icon: Sparkles },
      { path: '/blog-to-social', label: 'Blog→Social', icon: BookOpen },
      { path: '/carousel', label: 'Carousel', icon: GalleryHorizontal },
      { path: '/voice-learning', label: 'Brand Voice', icon: Mic },
      { path: '/comment-templates', label: 'Comment Tpls', icon: MessageSquare },
    ],
  },
  {
    label: 'Leads',
    links: [
      { path: '/lead-magnet-optin', label: 'Lead Magnets', icon: Magnet },
      { path: '/lead-outreach', label: 'Lead Outreach', icon: Send },
      { path: '/whatsapp-contacts', label: 'WA Contacts', icon: Users },
      { path: '/broadcast', label: 'Broadcast', icon: Radio },
    ],
  },
  {
    label: 'Workspace',
    links: [
      { path: '/tasks', label: 'Tasks', icon: CheckSquare },
      { path: '/team', label: 'Team', icon: UsersRound },
      { path: '/users', label: 'Users', icon: UserCog },
      { path: '/signatures', label: 'Signatures', icon: PenTool },
      { path: '/integrations', label: 'Integrations', icon: Puzzle },
      { path: '/webhooks', label: 'Webhooks', icon: Webhook },
      { path: '/approvals', label: 'Approvals', icon: CheckCircle },
      { path: '/bulk-import', label: 'Bulk Import', icon: Upload },
      { path: '/channel-health', label: 'Channel Health', icon: Activity },
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const sidebarStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  bottom: 0,
  width: '220px',
  background: 'var(--bg2)',
  borderRight: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
  zIndex: 100,
};

const logoStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '1.25rem 1rem 1rem',
  fontWeight: 700,
  fontSize: '1.1rem',
  color: 'var(--text)',
  letterSpacing: '-0.01em',
  flexShrink: 0,
};

const sectionHeaderStyle = {
  fontSize: '0.68rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: 'var(--text2)',
  padding: '0.75rem 1rem 0.25rem',
};

const navLinkBase = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.45rem 1rem',
  borderRadius: 'var(--radius)',
  margin: '0 0.5rem',
  fontSize: '0.85rem',
  textDecoration: 'none',
  transition: 'background 0.15s, color 0.15s',
};

const inactiveStyle = {
  ...navLinkBase,
  color: 'var(--text2)',
};

const activeStyle = {
  ...navLinkBase,
  background: 'var(--surface)',
  color: 'var(--text)',
};

const navListStyle = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
};

const mainStyle = {
  marginLeft: '220px',
  flex: 1,
  minHeight: '100vh',
  overflowY: 'auto',
  background: 'var(--bg)',
  padding: 0,
};

const bottomStyle = {
  borderTop: '1px solid var(--border)',
  padding: '0.75rem 1rem',
  marginTop: 'auto',
  flexShrink: 0,
};

const userEmailStyle = {
  fontSize: '0.78rem',
  color: 'var(--text2)',
  marginBottom: '0.5rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const userNameStyle = {
  fontSize: '0.85rem',
  fontWeight: 600,
  color: 'var(--text)',
  marginBottom: '0.25rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const logoutBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text2)',
  cursor: 'pointer',
  fontSize: '0.82rem',
  padding: '0.35rem 0.75rem',
  width: '100%',
  marginTop: '0.5rem',
  transition: 'color 0.15s, border-color 0.15s',
};

export default function Layout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex' }}>
      <aside style={sidebarStyle}>
        <div style={logoStyle}>
          <Zap size={20} color="var(--accent)" fill="var(--accent)" />
          FlomiPost
        </div>

        <nav style={{ flex: 1 }}>
          {navGroups.map((group) => (
            <div key={group.label}>
              <div style={sectionHeaderStyle}>{group.label}</div>
              <ul style={navListStyle}>
                {group.links.map(({ path, label, icon: Icon }) => (
                  <li key={path}>
                    <NavLink
                      to={path}
                      end={path === '/'}
                      style={({ isActive }) => isActive ? activeStyle : inactiveStyle}
                    >
                      <Icon size={15} />
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div style={bottomStyle}>
          {user?.name && <div style={userNameStyle}>{user.name}</div>}
          {user?.email && <div style={userEmailStyle}>{user.email}</div>}
          <button style={logoutBtnStyle} onClick={handleLogout}>
            <LogOut size={14} />
            Log out
          </button>
        </div>
      </aside>

      <main style={mainStyle}>
        <Outlet />
      </main>
    </div>
  );
}
