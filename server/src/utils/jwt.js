const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      username: user.username || null,
      role: user.role || 'user',
      accessTier: user.accessTier || user.coachMetadata?.accessTier || 'standard',
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn,
    }
  );
}

module.exports = {
  signAccessToken,
};
