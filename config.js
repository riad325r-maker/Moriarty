// config.js - Edit BACKEND_URL before deploying
const CONFIG = {
  BACKEND_URL: 'https://your-backend.railway.app', // ← غير هذا بعد رفع الـ backend
  APP_NAME: 'Moriarty',
  VERSION: '1.0.0'
};

if (typeof module !== 'undefined') module.exports = CONFIG;
