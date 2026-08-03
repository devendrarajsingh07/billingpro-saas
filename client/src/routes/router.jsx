import { createBrowserRouter, Navigate } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'

// Layouts
import MainLayout from '../layouts/MainLayout'
import AuthLayout from '../layouts/AuthLayout'

// Pages
import Login from '../pages/auth/Login'
import Register from '../pages/auth/Register'
import ForgotPassword from '../pages/auth/ForgotPassword'
import ResetPassword from '../pages/auth/ResetPassword'
import OAuthCallback from '../pages/auth/OAuthCallback'
import VerifyEmail from '../pages/auth/VerifyEmail'
import Dashboard from '../pages/dashboard/Dashboard'
import Customers from '../pages/customers/Customers'
import Suppliers from '../pages/suppliers/Suppliers'
import PurchaseOrders from '../pages/purchase-orders/PurchaseOrders'
import Products from '../pages/products/Products'
import Inventory from '../pages/inventory/Inventory'
import Invoices from '../pages/invoices/Invoices'
import Payments from '../pages/payments/Payments'
import Reports from '../pages/reports/Reports'
import Settings from '../pages/settings/Settings'
import ActivityLog from '../pages/activity/ActivityLog'
import NotFound from '../pages/NotFound'

const router = createBrowserRouter([
  // Public auth routes
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <Login /> },
      { path: '/register', element: <Register /> },
      { path: '/forgot-password', element: <ForgotPassword /> },
      { path: '/reset-password', element: <ResetPassword /> },
      { path: '/verify-email', element: <VerifyEmail /> },
      { path: '/auth/github/callback', element: <OAuthCallback /> },
      { path: '/auth/microsoft/callback', element: <OAuthCallback /> },
    ]
  },
  // Protected app routes
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { path: '/', element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <Dashboard /> },
          { path: '/customers', element: <Customers /> },
          { path: '/suppliers', element: <Suppliers /> },
          { path: '/purchase-orders', element: <PurchaseOrders /> },
          { path: '/products', element: <Products /> },
          { path: '/inventory', element: <Inventory /> },
          { path: '/invoices', element: <Invoices /> },
          { path: '/payments', element: <Payments /> },
          { path: '/reports', element: <Reports /> },
          { path: '/settings', element: <Settings /> },
          { path: '/activity', element: <ActivityLog /> },
        ]
      }
    ]
  },
  // Catch all
  { path: '*', element: <NotFound /> }
])

export default router
