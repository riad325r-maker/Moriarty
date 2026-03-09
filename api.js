// api.js - All API calls go through here
const API = {
  base: CONFIG.BACKEND_URL + '/api',

  getToken() { return localStorage.getItem('moriarty_token'); },
  setToken(t) { localStorage.setItem('moriarty_token', t); },
  clearToken() { localStorage.removeItem('moriarty_token'); localStorage.removeItem('moriarty_user'); },
  getUser() { return JSON.parse(localStorage.getItem('moriarty_user') || 'null'); },
  setUser(u) { localStorage.setItem('moriarty_user', JSON.stringify(u)); },

  async request(method, path, body = null) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.getToken() ? { Authorization: 'Bearer ' + this.getToken() } : {})
      }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(this.base + path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'خطأ في الطلب');
    return data;
  },

  get(path)         { return this.request('GET', path); },
  post(path, body)  { return this.request('POST', path, body); },
  put(path, body)   { return this.request('PUT', path, body); },
  delete(path)      { return this.request('DELETE', path); },

  // Auth
  login(email, password)                     { return this.post('/auth/login', { email, password }); },
  register(username, email, password)        { return this.post('/auth/register', { username, email, password }); },
  me()                                        { return this.get('/auth/me'); },

  // Servers
  getServers()                               { return this.get('/servers'); },
  createServer(data)                         { return this.post('/servers', data); },
  updateServer(id, data)                     { return this.put('/servers/' + id, data); },
  deleteServer(id)                           { return this.delete('/servers/' + id); },

  // Bots
  getBots(serverId)                          { return this.get('/bots/server/' + serverId); },
  getMyBots()                                { return this.get('/bots/mine'); },
  createBot(data)                            { return this.post('/bots', data); },
  startBot(id)                               { return this.post('/bots/' + id + '/start'); },
  stopBot(id)                                { return this.post('/bots/' + id + '/stop'); },
  updateBot(id, data)                        { return this.put('/bots/' + id, data); },
  deleteBot(id)                              { return this.delete('/bots/' + id); },
};
