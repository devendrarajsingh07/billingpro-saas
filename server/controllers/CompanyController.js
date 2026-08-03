'use strict';

const db = require('../config/database');
const CompanyRepository = require('../repositories/CompanyRepository');
const ApiResponse = require('../utils/ApiResponse');
const { NotFoundError } = require('../utils/ApiError');

const companyRepo = new CompanyRepository(db);

// Fields a company admin may edit via the general settings form. Deliberately
// excludes `plan` / `plan_expires_at` — those must only ever change through
// SubscriptionService (which goes through Razorpay), never a generic PUT.
// Without this allowlist, BaseRepository.update()'s column whitelist alone
// would happily accept `plan` since it's a real column on this table —
// letting any owner/admin grant themselves an enterprise plan for free.
const EDITABLE_COMPANY_FIELDS = [
  'name', 'email', 'phone', 'website', 'address', 'city', 'state', 'country',
  'postal_code', 'gst_number', 'pan_number', 'vat_number', 'logo',
  'currency_code', 'timezone', 'date_format', 'fiscal_year_start',
  'invoice_prefix', 'po_prefix',
];

function pickEditableFields(body) {
  const out = {};
  for (const key of EDITABLE_COMPANY_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

class CompanyController {
  static async getMe(req, res, next) {
    try {
      const company = companyRepo.findById(req.companyId);
      if (!company) throw new NotFoundError('Company not found.');
      res.json(ApiResponse.success(company, 'Company profile fetched successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async updateMe(req, res, next) {
    try {
      const company = companyRepo.update(req.companyId, null, pickEditableFields(req.body));
      res.json(ApiResponse.success(company, 'Company profile updated successfully.'));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = CompanyController;
