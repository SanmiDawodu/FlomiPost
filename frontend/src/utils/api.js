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
