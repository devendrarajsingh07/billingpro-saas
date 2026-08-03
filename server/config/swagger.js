'use strict';

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'SaaS Billing Platform API',
      version: '1.0.0',
      description: `
## Multi-Tenant SaaS Billing Platform

A comprehensive billing and business management platform supporting invoicing, inventory,
customer management, supplier management, purchase orders, payments, and financial reports.

### Authentication
All protected endpoints require a Bearer JWT token in the \`Authorization\` header.
Tokens are obtained via the \`POST /api/v1/auth/login\` endpoint.

### Multi-Tenancy
Every request is scoped to a company via the \`company_id\` embedded in your JWT.
You cannot access or modify data belonging to a different company.

### Rate Limiting
Authentication endpoints are rate-limited to **10 requests per 15 minutes** per IP.
General API endpoints are rate-limited to **100 requests per minute** per IP.
      `.trim(),
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:5001',
        description: 'Development server',
      },
      {
        url: 'https://your-domain.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token from POST /api/v1/auth/login',
        },
      },
      schemas: {
        // ── Common ─────────────────────────────────────────────
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation successful.' },
            data: { type: 'object' },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'array', items: { type: 'object' } },
            pagination: {
              type: 'object',
              properties: {
                page:       { type: 'integer', example: 1 },
                limit:      { type: 'integer', example: 20 },
                total:      { type: 'integer', example: 100 },
                totalPages: { type: 'integer', example: 5 },
              },
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'An error occurred.' },
            errors:  { type: 'array', items: { type: 'string' } },
          },
        },
        // ── Auth ───────────────────────────────────────────────
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email:    { type: 'string', format: 'email', example: 'admin@company.com' },
            password: { type: 'string', format: 'password', example: 'SecurePass123!' },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['name', 'email', 'password', 'company_name'],
          properties: {
            name:         { type: 'string', example: 'John Doe' },
            email:        { type: 'string', format: 'email', example: 'john@acme.com' },
            password:     { type: 'string', format: 'password', minLength: 8, example: 'SecurePass123!' },
            company_name: { type: 'string', example: 'Acme Corp' },
            phone:        { type: 'string', example: '+91 98765 43210' },
          },
        },
        AuthTokens: {
          type: 'object',
          properties: {
            accessToken:  { type: 'string', example: 'eyJhbGci...' },
            refreshToken: { type: 'string', example: 'eyJhbGci...' },
          },
        },
        UserProfile: {
          type: 'object',
          properties: {
            id:                { type: 'integer', example: 1 },
            name:              { type: 'string', example: 'John Doe' },
            email:             { type: 'string', example: 'john@acme.com' },
            phone:             { type: 'string', example: '+91 98765 43210' },
            role:              { type: 'string', example: 'owner' },
            is_email_verified: { type: 'boolean', example: true },
            created_at:        { type: 'string', format: 'date-time' },
          },
        },
        // ── Customer ───────────────────────────────────────────
        Customer: {
          type: 'object',
          properties: {
            id:           { type: 'integer', example: 1 },
            name:         { type: 'string', example: 'Acme Corp' },
            email:        { type: 'string', example: 'billing@acme.com' },
            phone:        { type: 'string', example: '+91 98765 43210' },
            gstin:        { type: 'string', example: '22AAAAA0000A1Z5' },
            address:      { type: 'string', example: '123 Main St, Mumbai' },
            credit_limit: { type: 'number', example: 50000 },
            balance:      { type: 'number', example: 12500 },
            created_at:   { type: 'string', format: 'date-time' },
          },
        },
        // ── Invoice ────────────────────────────────────────────
        Invoice: {
          type: 'object',
          properties: {
            id:            { type: 'integer', example: 1 },
            invoice_no:    { type: 'string', example: 'INV-2026-000001-abc123ef' },
            customer_id:   { type: 'integer', example: 1 },
            customer_name: { type: 'string', example: 'Acme Corp' },
            status:        { type: 'string', enum: ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'], example: 'sent' },
            issue_date:    { type: 'string', format: 'date', example: '2026-07-01' },
            due_date:      { type: 'string', format: 'date', example: '2026-07-31' },
            subtotal:      { type: 'number', example: 10000 },
            tax_total:     { type: 'number', example: 1800 },
            grand_total:   { type: 'number', example: 11800 },
            amount_due:    { type: 'number', example: 11800 },
            currency_code: { type: 'string', example: 'INR' },
            created_at:    { type: 'string', format: 'date-time' },
          },
        },
        // ── Product ────────────────────────────────────────────
        Product: {
          type: 'object',
          properties: {
            id:                  { type: 'integer', example: 1 },
            name:                { type: 'string', example: 'Laptop Pro 16"' },
            sku:                 { type: 'string', example: 'LAPTOP-PRO-16' },
            barcode:             { type: 'string', example: '1234567890123' },
            selling_price:       { type: 'number', example: 85000 },
            purchase_price:      { type: 'number', example: 60000 },
            stock:               { type: 'integer', example: 25 },
            low_stock_threshold: { type: 'integer', example: 5 },
            category:            { type: 'string', example: 'Electronics' },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
    tags: [
      { name: 'Auth',             description: 'Authentication and user management' },
      { name: 'Customers',        description: 'Customer CRUD and statements' },
      { name: 'Suppliers',        description: 'Supplier management and payments' },
      { name: 'Products',         description: 'Product catalog and pricing' },
      { name: 'Inventory',        description: 'Stock tracking and adjustments' },
      { name: 'Invoices',         description: 'Invoice lifecycle management' },
      { name: 'Payments',         description: 'Payment recording and tracking' },
      { name: 'Purchase Orders',  description: 'Purchase order workflow' },
      { name: 'Reports',          description: 'Financial and operational reports' },
      { name: 'Notifications',    description: 'User notification center' },
      { name: 'Search',           description: 'Global cross-entity search' },
      { name: 'Users',            description: 'Team member management' },
      { name: 'Settings',         description: 'Company settings and preferences' },
      { name: 'Payment Gateway',  description: 'Online payment via Razorpay' },
      { name: 'Health',           description: 'Service health checks' },
    ],
  },
  // Glob patterns for files containing @swagger JSDoc annotations
  apis: [
    './routes/v1/*.js',
    './controllers/*.js',
    './server.js',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
