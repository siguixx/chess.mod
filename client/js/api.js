const TOKEN_KEY = 'chess_mod_auth_token';

class ApiClient {
  getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
  }

  setToken(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {}
  }

  async request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(path, {
      credentials: 'include',
      ...options,
      headers
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Error HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  me() { return this.request('/api/auth/me'); }
  async register(payload) {
    const res = await this.request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
    if (res.token) this.setToken(res.token);
    return res;
  }
  async login(payload) {
    const res = await this.request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
    if (res.token) this.setToken(res.token);
    return res;
  }
  async logout() {
    await this.request('/api/auth/logout', { method: 'POST' }).catch(() => {});
    this.setToken('');
  }

  getCosmetics() { return this.request('/api/cosmetics'); }
  updateUsername(username) { return this.request('/api/profile/username', { method: 'PATCH', body: JSON.stringify({ username }) }); }
  updateAvatar(avatar) { return this.request('/api/profile/avatar', { method: 'PATCH', body: JSON.stringify({ avatar }) }); }
  updateCosmetics(payload) { return this.request('/api/profile/cosmetics', { method: 'PATCH', body: JSON.stringify(payload) }); }
  getLeaderboard() { return this.request('/api/leaderboard'); }
  validateCampaignStart(campaignId, levelId) {
    return this.request('/api/game/campaign/start', { method: 'POST', body: JSON.stringify({ campaignId, levelId }) });
  }
  spendHintXp() { return this.request('/api/game/hint', { method: 'POST', body: JSON.stringify({}) }); }
  reportMatch(payload) { return this.request('/api/game/report', { method: 'POST', body: JSON.stringify(payload) }); }
}

export const api = new ApiClient();
