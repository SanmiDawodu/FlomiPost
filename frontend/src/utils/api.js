// FlomiPost — API client

const BASE = '/api';

async function request(method, path, data = null, isForm = false) {
  const opts = {
    method,
    credentials: 'include',
    headers: isForm ? {} : { 'Content-Type': 'application/json' },
  };
  if (data) {
    opts.body = isForm ? data : JSON.stringify(data);
  }

  const res = await fetch(`${BASE}${path}`, opts);
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.fields = json.fields;
    throw err;
  }
  return json;
}

export const api = {
  get:    (path)         => request('GET',    path),
  post:   (path, data)   => request('POST',   path, data),
  put:    (path, data)   => request('PUT',    path, data),
  delete: (path)         => request('DELETE', path),
  upload: (path, form)   => request('POST',   path, form, true),
};

// ── Auth ──────────────────────────────────
export const authApi = {
  login:  (email, password) => api.post('/auth/login', { email, password }),
  logout: ()                => api.post('/auth/logout'),
  me:     ()                => api.get('/auth/me'),
};

// ── Posts ─────────────────────────────────
export const postsApi = {
  list:       (params = {}) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v != null)));
    return api.get(`/posts?${qs}`);
  },
  get:        (id)          => api.get(`/posts/${id}`),
  create:     (data)        => api.post('/posts', data),
  update:     (id, data)    => api.put(`/posts/${id}`, data),
  delete:     (id)          => api.delete(`/posts/${id}`),
  publishNow: (id)          => api.post(`/posts/${id}/publish-now`),
  stats:      ()            => api.get('/posts/stats'),
};

// ── Sites ─────────────────────────────────
export const sitesApi = {
  list:   ()       => api.get('/sites'),
  create: (data)   => api.post('/sites', data),
  update: (id, d)  => api.put(`/sites/${id}`, d),
};

// ── Platforms ─────────────────────────────
export const platformsApi = {
  list: () => api.get('/platforms'),
};

// ── Connections ───────────────────────────
export const connectionsApi = {
  list:   (siteId) => api.get(`/connections${siteId ? '?site_id=' + siteId : ''}`),
  create: (data)   => api.post('/connections', data),
  delete: (id)     => api.delete(`/connections/${id}`),
};

// ── Media ─────────────────────────────────
export const mediaApi = {
  upload: (file, siteId) => {
    const fd = new FormData();
    fd.append('file', file);
    if (siteId) fd.append('site_id', siteId);
    return api.upload('/media/upload', fd);
  },
  list: (params = {}) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v != null)));
    return api.get(`/media?${qs}`);
  },
};

// ── AI ────────────────────────────────────
export const aiApi = {
  generate: (opts)                       => api.post('/ai/caption', opts),
  improve:  (caption, instruction)       => api.post('/ai/improve', { caption, instruction }),
};

// ── Queue ─────────────────────────────────
export const queueApi = {
  list: () => api.get('/queue'),
};

// ── Users ─────────────────────────────────
export const usersApi = {
  list:   ()       => api.get('/users'),
  create: (data)   => api.post('/users', data),
  update: (id, d)  => api.put(`/users/${id}`, d),
};

// ── Settings ──────────────────────────────
export const settingsApi = {
  get:  ()     => api.get('/settings'),
  save: (data) => api.put('/settings', data),
};


// ── Posts: approval workflow + retry ──────
postsApi.submit   = (id)            => api.post(`/posts/${id}/submit`);
postsApi.approve  = (id)            => api.post(`/posts/${id}/approve`);
postsApi.reject   = (id, reason)    => api.post(`/posts/${id}/reject`, { reason });
postsApi.retry    = (id)            => api.post(`/posts/${id}/retry`);

export const approvalsApi = { list: () => api.get('/approvals') };
export const templatesApi = {
  list:   ()        => api.get('/templates'),
  create: (data)    => api.post('/templates', data),
  update: (id,data) => api.put(`/templates/${id}`, data),
  delete: (id)      => api.delete(`/templates/${id}`),
};
export const labelsApi = {
  list:   ()     => api.get('/labels'),
  create: (data) => api.post('/labels', data),
  delete: (id)   => api.delete(`/labels/${id}`),
};
export const analyticsApi = { get: (days=30) => api.get('/analytics?days='+days) };
aiApi.hashtags = (caption) => api.post('/ai/hashtags', { caption });
