import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const fetchPosts = async () => {
  const res = await fetch('/api/posts', { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error('Failed');
  const json = await res.json();
  return json.data || json;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const { data: posts = [], isLoading } = useQuery({ queryKey: ['posts'], queryFn: fetchPosts });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = getDaysInMonth(year, month);

  const postsByDay = {};
  posts.forEach(p => {
    const date = p.fire_at || p.scheduledAt || p.createdAt;
    if (!date) return;
    const d = new Date(date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!postsByDay[day]) postsByDay[day] = [];
      postsByDay[day].push(p);
    }
  });

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <CalendarDays size={20} color="var(--accent)" />
          <h1 style={{ margin: 0, color: 'var(--text)', fontWeight: 700, fontSize: '1.4rem' }}>Content Calendar</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={prev} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', cursor: 'pointer', padding: '0.3rem 0.5rem', display: 'flex', alignItems: 'center' }}><ChevronLeft size={16} /></button>
          <span style={{ color: 'var(--text)', fontWeight: 600, minWidth: 160, textAlign: 'center' }}>{MONTHS[month]} {year}</span>
          <button onClick={next} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', cursor: 'pointer', padding: '0.3rem 0.5rem', display: 'flex', alignItems: 'center' }}><ChevronRight size={16} /></button>
        </div>
      </div>

      {isLoading ? <div style={{ color: 'var(--text2)' }}>Loading…</div> : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
            {DAYS.map(d => (
              <div key={d} style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {cells.map((day, i) => {
              const dayPosts = day ? (postsByDay[day] || []) : [];
              const isToday = day && year === now.getFullYear() && month === now.getMonth() && day === now.getDate();
              return (
                <div key={i} style={{ minHeight: 90, borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--border)' : 'none', borderBottom: '1px solid var(--border)', padding: '0.4rem', background: day ? 'transparent' : 'var(--bg2)' }}>
                  {day && (
                    <>
                      <div style={{ fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--accent)' : 'var(--text2)', fontSize: '0.82rem', marginBottom: '0.25rem' }}>{day}</div>
                      {dayPosts.slice(0, 2).map((p, j) => (
                        <div key={j} title={p.caption} style={{ background: 'var(--accent)', borderRadius: 3, padding: '0.15rem 0.35rem', fontSize: '0.7rem', color: '#fff', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.caption ? p.caption.slice(0, 20) : 'Post'}
                        </div>
                      ))}
                      {dayPosts.length > 2 && <div style={{ fontSize: '0.7rem', color: 'var(--text2)' }}>+{dayPosts.length - 2} more</div>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
