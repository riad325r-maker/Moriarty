const mongoose = require('mongoose');

const botSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  icon:        { type: String, default: '🤖' },
  server:      { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
  owner:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  phoneNumber: { type: String, default: '' },
  status:      { type: String, enum: ['running', 'stopped', 'qr_pending', 'error'], default: 'stopped' },
  sessionData: { type: String, default: '' }, // base64 encoded Baileys session
  stats: {
    totalMessages: { type: Number, default: 0 },
    todayMessages: { type: Number, default: 0 },
    lastActive:    { type: Date }
  },
  settings: {
    autoReply:     { type: Boolean, default: false },
    autoReplyMsg:  { type: String, default: 'مرحباً! سأرد عليك قريباً.' },
    readReceipts:  { type: Boolean, default: true },
    prefix:        { type: String, default: '!' }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Bot', botSchema);
