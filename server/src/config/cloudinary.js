/*

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

*/
const cloudinary = require('cloudinary').v2;
const env = require('./env');

if (env.cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
  });
}

module.exports = {
  cloudinary,
  isCloudinaryConfigured: env.cloudinaryEnabled,
};
