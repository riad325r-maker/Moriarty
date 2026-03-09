const router = require('express').Router();
const Server = require('../models/Server');
const Bot = require('../models/Bot');
const auth = require('../middleware/auth');

// GET all servers for user
router.get('/', auth, async (req, res) => {
  try {
    const servers = await Server.find({
      $or: [{ owner: req.user._id }, { members: req.user._id }]
    }).populate('owner', 'username');

    // attach bot count to each
    const result = await Promise.all(servers.map(async s => {
      const botCount = await Bot.countDocuments({ server: s._id });
      const runningBots = await Bot.countDocuments({ server: s._id, status: 'running' });
      return { ...s.toObject(), botCount, runningBots };
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single server
router.get('/:id', auth, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id).populate('owner', 'username email');
    if (!server) return res.status(404).json({ error: 'السيرفر غير موجود' });
    res.json(server);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create server
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, icon, region } = req.body;
    if (!name) return res.status(400).json({ error: 'اسم السيرفر مطلوب' });

    const server = await Server.create({
      name, description, icon: icon || '🖥️',
      region: region || 'auto',
      owner: req.user._id,
      members: [req.user._id]
    });
    res.status(201).json(server);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update server
router.put('/:id', auth, async (req, res) => {
  try {
    const server = await Server.findOne({ _id: req.params.id, owner: req.user._id });
    if (!server) return res.status(404).json({ error: 'السيرفر غير موجود أو ليس لديك صلاحية' });

    const { name, description, icon } = req.body;
    if (name) server.name = name;
    if (description !== undefined) server.description = description;
    if (icon) server.icon = icon;
    await server.save();
    res.json(server);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE server
router.delete('/:id', auth, async (req, res) => {
  try {
    const server = await Server.findOne({ _id: req.params.id, owner: req.user._id });
    if (!server) return res.status(404).json({ error: 'السيرفر غير موجود أو ليس لديك صلاحية' });
    await Bot.deleteMany({ server: server._id });
    await server.deleteOne();
    res.json({ message: 'تم حذف السيرفر وجميع بوتاته' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
