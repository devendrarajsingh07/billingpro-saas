import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { CompanyProvider } from './context/CompanyContext'
import router from './routes/router'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CompanyProvider>
          <RouterProvider router={router} />
          <Toaster
            position="top-right"
            gutter={8}
            toastOptions={{
              style: {
                borderRadius: '12px',
                background: '#1e293b',
                color: '#f1f5f9',
                fontSize: '13px',
                fontWeight: '500',
                fontFamily: 'Inter, sans-serif',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                padding: '12px 16px',
              },
              success: {
                iconTheme: { primary: '#22c55e', secondary: '#f1f5f9' },
                duration: 3000,
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: '#f1f5f9' },
                duration: 4500,
              },
            }}
          />
        </CompanyProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
