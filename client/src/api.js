const BASE_URL = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no body
  }

  if (!res.ok) {
    const message = data?.error || `Greska (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload, auth: false }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload, auth: false }),
  me: () => request('/auth/me'),

  listGroups: () => request('/groups'),
  createGroup: (name) => request('/groups', { method: 'POST', body: { name } }),
  joinGroup: (inviteCode) => request('/groups/join', { method: 'POST', body: { inviteCode } }),
  groupMembers: (groupId) => request(`/groups/${groupId}/members`),
  leaveGroup: (groupId) => request(`/groups/${groupId}/leave`, { method: 'DELETE' }),
  deleteGroup: (groupId) => request(`/groups/${groupId}`, { method: 'DELETE' }),

  listCategories: (groupId) => request(`/groups/${groupId}/categories`),
  createCategory: (groupId, payload) =>
    request(`/groups/${groupId}/categories`, { method: 'POST', body: payload }),
  deleteCategory: (groupId, categoryId) =>
    request(`/groups/${groupId}/categories/${categoryId}`, { method: 'DELETE' }),

  listExpenses: (groupId, query = {}) => {
    const params = new URLSearchParams(query).toString();
    return request(`/groups/${groupId}/expenses${params ? `?${params}` : ''}`);
  },
  createExpense: (groupId, payload) =>
    request(`/groups/${groupId}/expenses`, { method: 'POST', body: payload }),
  deleteExpense: (groupId, expenseId) =>
    request(`/groups/${groupId}/expenses/${expenseId}`, { method: 'DELETE' }),
  summary: (groupId, month) => request(`/groups/${groupId}/expenses/summary?month=${month}`),

  getBudget: (groupId, month) => request(`/groups/${groupId}/budget?month=${month}`),
  setBudget: (groupId, payload) => request(`/groups/${groupId}/budget`, { method: 'PUT', body: payload }),

  aiInsights: (groupId, month) => request(`/groups/${groupId}/ai/insights?month=${month}`),
};
