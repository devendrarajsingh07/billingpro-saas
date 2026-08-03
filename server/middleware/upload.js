'use strict';

const path   = require('path');
const fs     = require('fs');
const multer = require('multer');

// ============================================================
// Ensure upload directories exist
// ============================================================
const UPLOAD_ROOT = path.resolve(__dirname, '../uploads');
const DIRS = {
  logos:       path.join(UPLOAD_ROOT, 'logos'),
  avatars:     path.join(UPLOAD_ROOT, 'avatars'),
  attachments: path.join(UPLOAD_ROOT, 'attachments'),
};

Object.values(DIRS).forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ============================================================
// MIME type whitelists
// ============================================================
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const DOC_MIMES   = ['application/pdf'];
const ALL_MIMES   = [...IMAGE_MIMES, ...DOC_MIMES];

// ============================================================
// Storage factory
// ============================================================
function createStorage(subfolder) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, DIRS[subfolder]);
    },
    filename: (_req, file, cb) => {
      const ext      = path.extname(file.originalname).toLowerCase();
      const safeName = path.basename(file.originalname, ext)
        .replace(/[^a-z0-9_\-]/gi, '_')
        .toLowerCase();
      const unique   = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      cb(null, `${safeName}-${unique}${ext}`);
    },
  });
}

// ============================================================
// Filter factory
// ============================================================
function createFilter(allowedMimes) {
  return (_req, file, cb) => {
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new multer.MulterError(
          'LIMIT_UNEXPECTED_FILE',
          `File type '${file.mimetype}' is not allowed. Accepted: ${allowedMimes.join(', ')}`
        ),
        false
      );
    }
  };
}

// ============================================================
// Multer instances
// ============================================================

/**
 * Upload company logo — images only, max 5MB, single file.
 */
const uploadLogo = multer({
  storage:  createStorage('logos'),
  limits:   { fileSize: 5 * 1024 * 1024 },
  fileFilter: createFilter(IMAGE_MIMES),
}).single('logo');

/**
 * Upload user avatar — images only, max 5MB, single file.
 */
const uploadAvatar = multer({
  storage:  createStorage('avatars'),
  limits:   { fileSize: 5 * 1024 * 1024 },
  fileFilter: createFilter(IMAGE_MIMES),
}).single('avatar');

/**
 * Upload document attachment — images + PDF, max 5MB, single file.
 */
const uploadAttachment = multer({
  storage:  createStorage('attachments'),
  limits:   { fileSize: 5 * 1024 * 1024 },
  fileFilter: createFilter(ALL_MIMES),
}).single('attachment');

/**
 * Upload multiple attachments — up to 5 files.
 */
const uploadMultipleAttachments = multer({
  storage:  createStorage('attachments'),
  limits:   { fileSize: 5 * 1024 * 1024 },
  fileFilter: createFilter(ALL_MIMES),
}).array('attachments', 5);

/**
 * Wraps a multer middleware to forward errors to Express's next().
 * This ensures multer errors flow through the global error handler.
 *
 * @param {Function} uploadMiddleware - A multer .single/.array/.fields result
 * @returns {Function} Express middleware
 */
function wrapMulter(uploadMiddleware) {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  };
}

module.exports = {
  uploadLogo:                 wrapMulter(uploadLogo),
  uploadAvatar:               wrapMulter(uploadAvatar),
  uploadAttachment:           wrapMulter(uploadAttachment),
  uploadMultipleAttachments:  wrapMulter(uploadMultipleAttachments),
  DIRS,
};
