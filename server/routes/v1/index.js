'use strict';

const express = require('express');
const router = express.Router();

const authRoutes           = require('./auth.routes');
const customerRoutes       = require('./customer.routes');
const productRoutes        = require('./product.routes');
const invoiceRoutes        = require('./invoice.routes');
const paymentRoutes        = require('./payment.routes');
const reportRoutes         = require('./report.routes');
const activityRoutes       = require('./activity.routes');
const searchRoutes         = require('./search.routes');
const supplierRoutes       = require('./supplier.routes');
const purchaseOrderRoutes  = require('./purchase-order.routes');
const inventoryRoutes      = require('./inventory.routes');
const notificationRoutes   = require('./notification.routes');
const subscriptionRoutes   = require('./subscription.routes');
const userRoutes           = require('./user.routes');
const companyRoutes        = require('./company.routes');
const paymentGatewayRoutes = require('./payment-gateway.routes');
const healthRoutes         = require('./health.routes');
const salesOrderRoutes     = require('./sales-order.routes');
const rolesRoutes          = require('./roles.routes');

// Mount V1 routes
router.use('/auth', authRoutes);
router.use('/customers', customerRoutes);
router.use('/products', productRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/payments', paymentRoutes);
router.use('/reports', reportRoutes);
router.use('/activity', activityRoutes);
router.use('/search', searchRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/purchase-orders', purchaseOrderRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/notifications', notificationRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/users', userRoutes);
router.use('/company', companyRoutes);
router.use('/payment-gateway', paymentGatewayRoutes);
router.use('/sales-orders', salesOrderRoutes);
router.use('/roles', rolesRoutes);

// Public routes (no auth required)
router.use('/health', healthRoutes);

module.exports = router;
