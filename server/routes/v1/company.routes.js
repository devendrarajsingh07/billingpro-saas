'use strict';

const express   = require('express');
const router    = express.Router();
const multer    = require('multer');
const path      = require('path');
const fs        = require('fs');
const CompanyController = require('../../controllers/CompanyController');
const authenticate      = require('../../middleware/authenticate').authenticate;
const authorize         = require('../../middleware/authorize').authorize;
const ApiResponse       = require('../../utils/ApiResponse');
const db                = require('../../config/database');

// Multer config — logos go to server/uploads/logos/
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/logos');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `company-${req.companyId}-${Date.now()}${ext}`);
  },
});
const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.svg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files (jpg, png, svg, webp) are allowed.'));
  },
});

router.use(authenticate);

/**
 * @swagger
 * /api/v1/company/me:
 *   get:
 *     tags: [Company]
 *     summary: Get the current company's settings profile
 *     responses:
 *       200: { description: Company settings, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 *   put:
 *     tags: [Company]
 *     summary: Update company settings (name, GSTIN, currency, invoice prefix, address, etc.)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:            { type: string, example: 'Acme Corp' }
 *               gstin:           { type: string, example: '22AAAAA0000A1Z5' }
 *               currency_code:   { type: string, example: 'INR' }
 *               invoice_prefix:  { type: string, example: 'INV' }
 *               address:         { type: string }
 *     responses:
 *       200: { description: Company updated, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.get('/me',  CompanyController.getMe);
router.put('/me',  authorize('settings.update'), CompanyController.updateMe);

/**
 * @swagger
 * /api/v1/company/logo:
 *   post:
 *     tags: [Company]
 *     summary: Upload or replace the company logo (jpg/png/svg/webp, max 2MB)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               logo: { type: string, format: binary }
 *     responses:
 *       200: { description: Logo updated, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 *       400: { description: No file uploaded or invalid file type, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.post('/logo', authorize('settings.update'), logoUpload.single('logo'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json(ApiResponse.error('No file uploaded.'));
    const logoUrl = `/uploads/logos/${req.file.filename}`;
    db.prepare(`UPDATE companies SET logo = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(logoUrl, req.companyId);
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.companyId);
    res.json(ApiResponse.success({ logo: logoUrl, company }, 'Company logo updated successfully.'));
  } catch (err) { next(err); }
});

module.exports = router;
