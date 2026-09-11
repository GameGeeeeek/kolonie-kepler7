// Test-DB mit einem bestaetigten Konto. Nur lokal, beruehrt die echte db.json nie.
const bcrypt = require(process.env.BCRYPT ||
  require('path').join(__dirname, '..', '..', 'kolonie-kepler7-backend', 'node_modules', 'bcryptjs'));
const fs = require('fs'), crypto = require('crypto');
const DB = process.argv[2];
const userId = crypto.randomUUID();
const hash = bcrypt.hashSync('demo123456', 10);
fs.writeFileSync(DB, JSON.stringify({
  users: { kommandant: { userId, username: 'Kommandant', passwordHash: hash, tokenVersion: 0,
    createdAt: Date.now(), email: 'demo@example.invalid', emailVerified: true } },
  private: {}, shared: {}, resetTokens: {}
}, null, 1));
console.log(userId);
