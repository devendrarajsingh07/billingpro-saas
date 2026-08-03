'use strict';

const db = require('../config/database');

class ReportService {
  /**
   * Main dashboard analytics overview.
   */
  static getDashboardSummary(companyId) {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const today = now.toISOString().split('T')[0];

    // 1. Core KPIs
    const totals = db.prepare(`
      SELECT
        COALESCE(SUM(grand_total), 0) AS total_revenue,
        COALESCE(SUM(amount_paid), 0) AS total_collected,
        COALESCE(SUM(amount_due), 0) AS total_outstanding
      FROM invoices
      WHERE company_id = ? AND is_deleted = 0 AND status != 'draft'
    `).get(companyId);

    const monthlyRevenue = db.prepare(`
      SELECT COALESCE(SUM(grand_total), 0) AS value
      FROM invoices
      WHERE company_id = ? AND is_deleted = 0 AND status != 'draft' AND date LIKE ?
    `).get(companyId, `${currentMonth}%`).value;

    const todayRevenue = db.prepare(`
      SELECT COALESCE(SUM(grand_total), 0) AS value
      FROM invoices
      WHERE company_id = ? AND is_deleted = 0 AND status != 'draft' AND date = ?
    `).get(companyId, today).value;

    const customersCount = db.prepare(`
      SELECT COUNT(*) AS total FROM customers WHERE company_id = ? AND is_deleted = 0
    `).get(companyId).total;

    const productsCount = db.prepare(`
      SELECT COUNT(*) AS total FROM products WHERE company_id = ? AND is_deleted = 0
    `).get(companyId).total;

    const lowStockCount = db.prepare(`
      SELECT COUNT(*) AS total FROM products
      WHERE company_id = ? AND is_deleted = 0 AND is_service = 0 AND stock <= low_stock_threshold
    `).get(companyId).total;

    const pendingInvoicesCount = db.prepare(`
      SELECT COUNT(*) AS total FROM invoices
      WHERE company_id = ? AND is_deleted = 0 AND status IN ('pending', 'sent', 'viewed', 'partial')
    `).get(companyId).total;

    // 2. Charts: Revenue by Month (last 12 months)
    const revenueByMonth = db.prepare(`
      SELECT
        strftime('%Y-%m', date) AS month,
        SUM(grand_total) AS revenue,
        SUM(amount_paid) AS collected
      FROM invoices
      WHERE company_id = ? AND is_deleted = 0 AND status != 'draft'
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `).all(companyId).reverse();

    // 3. Charts: Invoice Status Breakdown
    const invoiceStatus = db.prepare(`
      SELECT status, COUNT(*) AS count, SUM(grand_total) AS amount
      FROM invoices
      WHERE company_id = ? AND is_deleted = 0
      GROUP BY status
    `).all(companyId);

    // 4. Charts: Top 5 Customers (by sales volume)
    const topCustomers = db.prepare(`
      SELECT c.name, SUM(i.grand_total) AS value
      FROM invoices i
      JOIN customers c ON c.id = i.customer_id
      WHERE i.company_id = ? AND i.is_deleted = 0 AND i.status != 'draft'
      GROUP BY i.customer_id
      ORDER BY value DESC
      LIMIT 5
    `).all(companyId);

    // 5. Charts: Best Selling Products
    const bestSellers = db.prepare(`
      SELECT p.name, SUM(ii.qty) AS quantity, SUM(ii.total) AS value
      FROM invoice_items ii
      JOIN invoices i ON i.id = ii.invoice_id
      JOIN products p ON p.id = ii.product_id
      WHERE i.company_id = ? AND i.is_deleted = 0 AND i.status != 'draft'
      GROUP BY ii.product_id
      ORDER BY value DESC
      LIMIT 5
    `).all(companyId);

    // 6. Recent invoices
    const recentInvoices = db.prepare(`
      SELECT i.id, i.invoice_no, i.date, i.grand_total, i.status, c.name AS customer_name
      FROM invoices i
      JOIN customers c ON c.id = i.customer_id
      WHERE i.company_id = ? AND i.is_deleted = 0
      ORDER BY i.id DESC
      LIMIT 5
    `).all(companyId);

    // 7. Recent activity log
    const recentActivity = db.prepare(`
      SELECT a.*, u.name AS user_name
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE a.company_id = ?
      ORDER BY a.id DESC
      LIMIT 5
    `).all(companyId);

    return {
      kpis: {
        totalRevenue: totals.total_revenue,
        totalCollected: totals.total_collected,
        totalOutstanding: totals.total_outstanding,
        monthlyRevenue,
        todayRevenue,
        customers: customersCount,
        products: productsCount,
        lowStock: lowStockCount,
        pendingInvoices: pendingInvoicesCount,
      },
      charts: {
        revenueTrend: revenueByMonth,
        invoiceStatus,
        topCustomers,
        bestSellers,
      },
      recentInvoices,
      recentActivity,
    };
  }

  /**
   * Profit & Loss report details.
   */
  static getProfitLoss(companyId, fromDate, toDate) {
    const sales = db.prepare(`
      SELECT COALESCE(SUM(grand_total), 0) AS total
      FROM invoices
      WHERE company_id = ? AND is_deleted = 0 AND status != 'draft'
        AND date >= ? AND date <= ?
    `).get(companyId, fromDate, toDate).total;

    const expenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM expenses
      WHERE company_id = ? AND is_deleted = 0
        AND date >= ? AND date <= ?
    `).get(companyId, fromDate, toDate).total;

    return {
      income: sales,
      expenses,
      netProfit: sales - expenses,
      period: { from: fromDate, to: toDate }
    };
  }

  /**
   * Tax collection details.
   */
  static getTaxReport(companyId, fromDate, toDate) {
    const taxSummary = db.prepare(`
      SELECT
        ii.tax_rate AS rate,
        SUM(ii.tax_amount) AS tax_collected,
        SUM(ii.total - ii.tax_amount) AS taxable_amount
      FROM invoice_items ii
      JOIN invoices i ON i.id = ii.invoice_id
      WHERE i.company_id = ? AND i.is_deleted = 0 AND i.status != 'draft'
        AND i.date >= ? AND i.date <= ?
      GROUP BY rate
      ORDER BY rate ASC
    `).all(companyId, fromDate, toDate);

    return {
      taxes: taxSummary,
      period: { from: fromDate, to: toDate }
    };
  }

  /**
   * Supplier spend report — total procurement value per supplier.
   * Only counts POs that actually resulted in received goods (spend that
   * happened), within the given date range, ordered by highest spend first.
   */
  static getSupplierSpend(companyId, fromDate, toDate) {
    const bySupplier = db.prepare(`
      SELECT
        s.id AS supplier_id,
        s.name AS supplier_name,
        COUNT(po.id) AS order_count,
        COALESCE(SUM(po.total), 0) AS total_spend
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.company_id = ? AND po.is_deleted = 0 AND po.status = 'received'
        AND po.date >= ? AND po.date <= ?
      GROUP BY po.supplier_id
      ORDER BY total_spend DESC
    `).all(companyId, fromDate, toDate);

    const totals = db.prepare(`
      SELECT COUNT(po.id) AS order_count, COALESCE(SUM(po.total), 0) AS total_spend
      FROM purchase_orders po
      WHERE po.company_id = ? AND po.is_deleted = 0 AND po.status = 'received'
        AND po.date >= ? AND po.date <= ?
    `).get(companyId, fromDate, toDate);

    return {
      suppliers: bySupplier,
      totalOrders: totals.order_count,
      totalSpend: totals.total_spend,
      period: { from: fromDate, to: toDate },
    };
  }

  /**
   * Inventory valuation report — current stock value at cost (purchase_price)
   * and at retail (selling_price) for every tracked (non-service) product.
   */
  static getInventoryValuation(companyId) {
    const products = db.prepare(`
      SELECT
        id, name, sku, stock, purchase_price, selling_price,
        (stock * purchase_price) AS cost_value,
        (stock * selling_price) AS retail_value
      FROM products
      WHERE company_id = ? AND is_deleted = 0 AND is_service = 0
      ORDER BY cost_value DESC
    `).all(companyId);

    const totals = products.reduce((acc, p) => {
      acc.totalUnits += p.stock;
      acc.totalCostValue += p.cost_value;
      acc.totalRetailValue += p.retail_value;
      return acc;
    }, { totalUnits: 0, totalCostValue: 0, totalRetailValue: 0 });

    return {
      products,
      ...totals,
      potentialProfit: totals.totalRetailValue - totals.totalCostValue,
    };
  }

  /**
   * Purchase order aging report — how long orders that are still open
   * (draft or sent — i.e. not yet received or cancelled) have been waiting,
   * bucketed into standard aging windows.
   */
  static getPOAging(companyId) {
    const openOrders = db.prepare(`
      SELECT po.id, po.po_no, po.date, po.total, po.status,
             s.name AS supplier_name,
             CAST(julianday('now') - julianday(po.date) AS INTEGER) AS days_open
      FROM purchase_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.company_id = ? AND po.is_deleted = 0 AND po.status IN ('draft', 'sent')
      ORDER BY days_open DESC
    `).all(companyId);

    const buckets = {
      '0-30': { label: '0-30 days', count: 0, value: 0 },
      '31-60': { label: '31-60 days', count: 0, value: 0 },
      '61-90': { label: '61-90 days', count: 0, value: 0 },
      '90+': { label: '90+ days', count: 0, value: 0 },
    };

    for (const po of openOrders) {
      const key = po.days_open <= 30 ? '0-30' : po.days_open <= 60 ? '31-60' : po.days_open <= 90 ? '61-90' : '90+';
      buckets[key].count += 1;
      buckets[key].value += po.total;
    }

    return {
      orders: openOrders,
      buckets: Object.values(buckets),
      totalOpenOrders: openOrders.length,
      totalOpenValue: openOrders.reduce((sum, po) => sum + po.total, 0),
    };
  }
}

module.exports = ReportService;
