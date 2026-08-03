import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function MainLayout() {
  return (
    <div className="app-shell">
      {/* Navigation Sidebar */}
      <Sidebar />
      
      {/* Main viewport */}
      <div className="app-main">
        {/* Navigation Topbar */}
        <Topbar />
        
        {/* Scrollable Page Body */}
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
