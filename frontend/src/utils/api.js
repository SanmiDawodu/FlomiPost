const request = async (method, path, body) => {
  const headers = {
    'Content-Type': 'application/json',
  };

  const token = localStorage.getItem('fp_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`/api${path}`, options);

  let parsed;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const message = (parsed && parsed.message) || response.statusText;
    throw new Error(message);
  }

  return { data: parsed };
};

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path, body) => request('DELETE', path, body),
};

export const postsApi = {
  list: (params='') => api.get(`/posts${params}`),
  get: (id) => api.get(`/posts/${id}`),
  create: (body) => api.post('/posts', body),
  update: (id, body) => api.put(`/posts/${id}`, body),
  delete: (id) => api.delete(`/posts/${id}`),
}

export const sitesApi = {
  list: () => api.get('/sites'),
}

export const platformsApi = {
  list: () => api.get('/platforms'),
}

export const connectionsApi = {
  list: (params='') => api.get(`/connections${params}`),
}

export const mediaApi = {
  list: () => api.get('/media'),
  upload: (formData) => {
    const token = localStorage.getItem('fp_token')
    return fetch('/api/media/upload', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(r => r.json())
  },
}

export const aiApi = {
  generateCaption: (body) => api.post('/ai/generate-caption', body),
}
