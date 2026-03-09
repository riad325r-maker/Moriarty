const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  icon:        { type: String, default: '🖥️' },
  owner:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  apiKey:      { type: String, unique: true },
  region:      { type: String, default: 'auto' },
  status:      { type: String, enum: ['active', 'suspended'], default: 'active' },
  createdAt:   { type: Date, default: Date.now }
});

// Generate API key before save
serverSchema.pre('save', function(next) {
  if (!this.apiKey) {
    this.apiKey = 'mrt_' + require('crypto').randomBytes(24).toString('hex');
  }
  next();
});

module.exports = mongoose.model('Server', serverSchema);
