const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      username: user.username || null,
      role: user.role || 'viewer',
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
