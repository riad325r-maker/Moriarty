const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: 'جميع الحقول مطلوبة' });

    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) return res.status(409).json({ error: 'البريد أو اسم المستخدم مستخدم مسبقاً' });

    const user = await User.create({ username, email, password });
    const token = signToken(user._id);
    res.status(201).json({ token, user: { id: user._id, username, email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'البريد وكلمة المرور مطلوبان' });

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });

    const token = signToken(user._id);
    res.json({ token, user: { id: user._id, username: user.username, email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
