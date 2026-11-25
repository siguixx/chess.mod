const TOKEN_KEY = 'chess_mod_auth_token';
const SNAPSHOT_KEY = 'chess_mod_account_snapshot_v1';

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

  getSnapshot() {
    try { return localStorage.getItem(SNAPSHOT_KEY) || ''; } catch { return ''; }
  }

  setSnapshot(snap) {
    try {
      if (snap) localStorage.setItem(SNAPSHOT_KEY, snap);
      else localStorage.removeItem(SNAPSHOT_KEY);
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

  async me() {
    const res = await this.request('/api/auth/me');
    if (res.authenticated && res.token) {
      this.setToken(res.token);
      if (res.snapshot) this.setSnapshot(res.snapshot);
      return res;
    }
    // Si el servidor fue actualizado/reiniciado sin BD externa, restaurar cuenta automáticamente con el respaldo firmado HMAC
    const savedSnap = this.getSnapshot();
    if (!res.authenticated && savedSnap) {
      try {
        const restored = await this.request('/api/auth/restore-snapshot', {
          method: 'POST',
          body: JSON.stringify({ snapshot: savedSnap })
        });
        if (restored.token && restored.user) {
          this.setToken(restored.token);
          if (restored.snapshot) this.setSnapshot(restored.snapshot);
          return { authenticated: true, restored: true, token: restored.token, user: restored.user, googleOAuthConfigured: res.googleOAuthConfigured };
        }
      } catch {}
    }
    return res;
  }

  async register(payload) {
    const res = await this.request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
    if (res.token) this.setToken(res.token);
    if (res.snapshot) this.setSnapshot(res.snapshot);
    return res;
  }

  async login(payload) {
    const res = await this.request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
    if (res.token) this.setToken(res.token);
    if (res.snapshot) this.setSnapshot(res.snapshot);
    return res;
  }

  async logout() {
    await this.request('/api/auth/logout', { method: 'POST' }).catch(() => {});
    this.setToken('');
    this.setSnapshot('');
  }

  async syncSnapshot() {
    if (!this.getToken()) return;
    try {
      const res = await this.request('/api/auth/me');
      if (res.snapshot) this.setSnapshot(res.snapshot);
    } catch {}
  }

  getCosmetics() { return this.request('/api/cosmetics'); }
  getShop() { return this.request('/api/shop'); }
  getVipStatus() { return this.request('/api/vip/status'); }
  async buyShopItem(itemId) {
    const res = await this.request('/api/shop/buy', { method: 'POST', body: JSON.stringify({ itemId }) });
    this.syncSnapshot();
    return res;
  }
  startModVipCheckout() { return this.request('/api/vip/checkout', { method: 'POST', body: JSON.stringify({}) }); }
  async verifyModVipPayment(sessionId) {
    const res = await this.request('/api/vip/verify-payment', { method: 'POST', body: JSON.stringify({ sessionId }) });
    this.syncSnapshot();
    return res;
  }
  async cancelModVip() {
    const res = await this.request('/api/vip/cancel', { method: 'POST', body: JSON.stringify({}) });
    this.syncSnapshot();
    return res;
  }
  async updateUsername(username) {
    const res = await this.request('/api/profile/username', { method: 'PATCH', body: JSON.stringify({ username }) });
    this.syncSnapshot();
    return res;
  }
  async updateAvatar(avatar) {
    const res = await this.request('/api/profile/avatar', { method: 'PATCH', body: JSON.stringify({ avatar }) });
    this.syncSnapshot();
    return res;
  }
  async updateCosmetics(payload) {
    const res = await this.request('/api/profile/cosmetics', { method: 'PATCH', body: JSON.stringify(payload) });
    this.syncSnapshot();
    return res;
  }
  getLeaderboard() { return this.request('/api/leaderboard'); }
  validateCampaignStart(campaignId, levelId) {
    return this.request('/api/game/campaign/start', { method: 'POST', body: JSON.stringify({ campaignId, levelId }) });
  }
  async spendHintXp() {
    const res = await this.request('/api/game/hint', { method: 'POST', body: JSON.stringify({}) });
    this.syncSnapshot();
    return res;
  }
  async reportMatch(payload) {
    const res = await this.request('/api/game/report', { method: 'POST', body: JSON.stringify(payload) });
    this.syncSnapshot();
    return res;
  }

  // Clanes
  getClans() { return this.request('/api/clans'); }
  async createClan(payload) {
    const res = await this.request('/api/clans', { method: 'POST', body: JSON.stringify(payload) });
    this.syncSnapshot();
    return res;
  }
  joinClan(clanId) { return this.request(`/api/clans/${encodeURIComponent(clanId)}/join`, { method: 'POST', body: '{}' }); }
  leaveClan() { return this.request('/api/clans/leave', { method: 'POST', body: '{}' }); }

  // Amigos
  getFriends() { return this.request('/api/friends'); }
  sendFriendRequest(username) { return this.request('/api/friends/request', { method: 'POST', body: JSON.stringify({ username }) }); }
  acceptFriend(id) { return this.request(`/api/friends/${encodeURIComponent(id)}/accept`, { method: 'POST', body: '{}' }); }
  rejectFriend(id) { return this.request(`/api/friends/${encodeURIComponent(id)}/reject`, { method: 'POST', body: '{}' }); }
  removeFriend(id) { return this.request(`/api/friends/${encodeURIComponent(id)}`, { method: 'DELETE' }); }

  // Reportes de Hacks y Cheats
  submitReport(payload) { return this.request('/api/reports', { method: 'POST', body: JSON.stringify(payload) }); }

  // Moderación
  getModOverview() { return this.request('/api/mod/overview'); }
  modBanUser(userId, reason) { return this.request('/api/mod/ban', { method: 'POST', body: JSON.stringify({ userId, reason }) }); }
  modUnbanUser(userId) { return this.request('/api/mod/unban', { method: 'POST', body: JSON.stringify({ userId }) }); }
  modResolveReport(reportId, status, resolutionNote) {
    return this.request(`/api/mod/reports/${encodeURIComponent(reportId)}/resolve`, { method: 'POST', body: JSON.stringify({ status, resolutionNote }) });
  }
  async modGrantAll() {
    const res = await this.request('/api/mod/grant-all', { method: 'POST', body: '{}' });
    this.syncSnapshot();
    return res;
  }
}

export const api = new ApiClient();
