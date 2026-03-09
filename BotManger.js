const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const path = require('path');
const fs = require('fs');
const Bot = require('../models/Bot');

const activeBots = new Map();
let _io = null;
const sessionsDir = path.join(__dirname, '../../sessions');
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

function setIO(io) { _io = io; }
function emit(botId, ev, data) { if (_io) _io.to(`bot:${botId}`).emit(ev, data); }
function log(botId, type, message) {
  emit(botId, 'bot:log', { type, message, time: new Date().toISOString() });
  console.log(`[${type.toUpperCase()}][${botId.slice(-6)}] ${message}`);
}

async function startBot(botId, botName) {
  if (activeBots.has(botId)) await stopBot(botId);
  const sessionPath = path.join(sessionsDir, botId);
  if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: require('pino')({ level: 'silent' })
  });

  activeBots.set(botId, sock);
  await Bot.findByIdAndUpdate(botId, { status: 'pairing' });
  log(botId, 'info', 'البوت يتهيأ... أدخل رقم الواتساب للحصول على كود الربط');

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'open') {
      const phone = sock.user?.id?.split(':')[0] || '';
      await Bot.findByIdAndUpdate(botId, { status:'running', phoneNumber:phone, 'stats.lastActive':new Date() });
      emit(botId, 'bot:connected', { phone });
      log(botId, 'success', `✅ متصل بنجاح — ${phone}`);
    }
    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        log(botId, 'warn', '🔄 إعادة الاتصال...');
        setTimeout(() => startBot(botId, botName), 4000);
      } else {
        await Bot.findByIdAndUpdate(botId, { status:'stopped', phoneNumber:'' });
        activeBots.delete(botId);
        emit(botId, 'bot:disconnected', {});
        log(botId, 'error', '❌ تم قطع الاتصال — يرجى إعادة التشغيل');
        fs.rmSync(sessionPath, { recursive:true, force:true });
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const from = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      log(botId, 'info', `💬 ${from?.split('@')[0]}: ${text.slice(0,60)}`);
      await Bot.findByIdAndUpdate(botId, { $inc:{'stats.totalMessages':1,'stats.todayMessages':1}, 'stats.lastActive':new Date() });
      emit(botId, 'bot:message', { from, text, time: new Date().toISOString() });
    }
  });

  return sock;
}

async function requestPairCode(botId, phoneNumber) {
  let sock = activeBots.get(botId);
  if (!sock) {
    await startBot(botId, '');
    sock = activeBots.get(botId);
    // Wait a moment for socket to init
    await new Promise(r => setTimeout(r, 2000));
    sock = activeBots.get(botId);
  }
  if (!sock) throw new Error('فشل تهيئة البوت');
  try {
    const code = await sock.requestPairingCode(phoneNumber.replace(/\D/g,''));
    emit(botId, 'bot:pairCode', { code });
    log(botId, 'info', `🔗 كود الربط: ${code}`);
    await Bot.findByIdAndUpdate(botId, { status:'pairing' });
    return code;
  } catch(err) {
    log(botId, 'error', 'فشل طلب الكود: ' + err.message);
    throw err;
  }
}

async function stopBot(botId) {
  const sock = activeBots.get(botId);
  if (sock) { try { sock.end(); } catch(e){} activeBots.delete(botId); }
  await Bot.findByIdAndUpdate(botId, { status:'stopped' });
  log(botId, 'warn', '⏹ تم إيقاف البوت');
}

module.exports = { startBot, stopBot, requestPairCode, setIO };
