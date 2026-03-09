const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const Bot = require('../models/Bot');
const Server = require('../models/Server');
const auth = require('../middleware/auth');
const BotManager = require('../bots/BotManager');

// Simple file storage (no multer needed for basic use)
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// GET bots for a server
router.get('/server/:serverId', auth, async (req, res) => {
  try {
    const bots = await Bot.find({ server: req.params.serverId });
    res.json(bots);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET all my bots
router.get('/mine', auth, async (req, res) => {
  try {
    const bots = await Bot.find({ owner: req.user._id }).populate('server', 'name icon');
    res.json(bots);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create bot
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, icon, serverId } = req.body;
    if (!name || !serverId) return res.status(400).json({ error: 'اسم البوت والسيرفر مطلوبان' });
    const server = await Server.findById(serverId);
    if (!server) return res.status(404).json({ error: 'السيرفر غير موجود' });
    const bot = await Bot.create({ name, description, icon: icon||'🤖', server: serverId, owner: req.user._id });
    res.status(201).json(bot);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST start bot (init Baileys session)
router.post('/:id/start', auth, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.id, owner: req.user._id });
    if (!bot) return res.status(404).json({ error: 'البوت غير موجود' });
    await BotManager.startBot(bot._id.toString(), bot.name);
    res.json({ message: 'تم تهيئة البوت — أدخل رقمك للحصول على كود الربط' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST request pairing code (Baileys phone pairing)
router.post('/:id/pair', auth, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'رقم الواتساب مطلوب' });
    const bot = await Bot.findOne({ _id: req.params.id, owner: req.user._id });
    if (!bot) return res.status(404).json({ error: 'البوت غير موجود' });
    const code = await BotManager.requestPairCode(bot._id.toString(), phone);
    res.json({ code, message: 'كود الربط جاهز' });
  } catch (err) {
    // Code might come via socket even if this fails
    res.status(202).json({ message: 'سيصل الكود عبر الاتصال المباشر', error: err.message });
  }
});

// POST stop bot
router.post('/:id/stop', auth, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.id, owner: req.user._id });
    if (!bot) return res.status(404).json({ error: 'البوت غير موجود' });
    await BotManager.stopBot(bot._id.toString());
    bot.status = 'stopped'; await bot.save();
    res.json({ message: 'تم إيقاف البوت' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST upload bot files
router.post('/:id/upload', auth, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.id, owner: req.user._id });
    if (!bot) return res.status(404).json({ error: 'البوت غير موجود' });

    const botUploadsDir = path.join(uploadsDir, req.params.id);
    if (!fs.existsSync(botUploadsDir)) fs.mkdirSync(botUploadsDir, { recursive: true });

    // Files come as base64 in JSON body: { files: [{name, data, type}] }
    const { files } = req.body;
    if (!files || !Array.isArray(files)) return res.status(400).json({ error: 'لا توجد ملفات' });

    const saved = [];
    for (const f of files) {
      const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = path.join(botUploadsDir, safeName);
      const buffer = Buffer.from(f.data, 'base64');
      fs.writeFileSync(filePath, buffer);
      saved.push(safeName);
    }

    res.json({ message: `تم رفع ${saved.length} ملف`, files: saved });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET list bot uploaded files
router.get('/:id/files', auth, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.id, owner: req.user._id });
    if (!bot) return res.status(404).json({ error: 'البوت غير موجود' });
    const botDir = path.join(uploadsDir, req.params.id);
    if (!fs.existsSync(botDir)) return res.json({ files: [] });
    const files = fs.readdirSync(botDir).map(name => {
      const stat = fs.statSync(path.join(botDir, name));
      return { name, size: stat.size, modified: stat.mtime };
    });
    res.json({ files });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update bot settings
router.put('/:id', auth, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.id, owner: req.user._id });
    if (!bot) return res.status(404).json({ error: 'البوت غير موجود' });
    const { name, description, icon, settings } = req.body;
    if (name) bot.name = name;
    if (description !== undefined) bot.description = description;
    if (icon) bot.icon = icon;
    if (settings) bot.settings = { ...bot.settings, ...settings };
    await bot.save();
    res.json(bot);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE bot
router.delete('/:id', auth, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.id, owner: req.user._id });
    if (!bot) return res.status(404).json({ error: 'البوت غير موجود' });
    await BotManager.stopBot(bot._id.toString());
    // Clean up session + files
    const sessionPath = path.join(__dirname, '../../sessions', bot._id.toString());
    const uploadsPath = path.join(uploadsDir, bot._id.toString());
    if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive:true, force:true });
    if (fs.existsSync(uploadsPath)) fs.rmSync(uploadsPath, { recursive:true, force:true });
    await bot.deleteOne();
    res.json({ message: 'تم حذف البوت' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
