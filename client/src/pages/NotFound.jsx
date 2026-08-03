import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-height-screen flex flex-col items-center justify-center bg-slate-900 text-slate-100 p-6 text-center">
      <h1 className="text-8xl font-black text-indigo-500 tracking-wider">404</h1>
      <h2 className="text-2xl font-bold mt-4 mb-2">Page Not Found</h2>
      <p className="text-sm text-slate-400 max-w-sm mx-auto mb-8 leading-relaxed">
        The page you are looking for doesn't exist or has been moved. Let's get you back.
      </p>
      <Link to="/dashboard" className="btn btn-primary btn-md">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>
    </div>
  )
}
