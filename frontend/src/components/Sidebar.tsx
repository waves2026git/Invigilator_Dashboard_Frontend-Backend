import { NavLink } from 'react-router-dom'

export function Sidebar() {
  const navItems = [
    { to: '/', label: 'Dashboard', exact: true },
    { to: '/devices', label: 'Devices' },
    { to: '/exams', label: 'Exam Control' },
  ]

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen p-4">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-gray-900">Device Management</h1>
        <p className="text-sm text-gray-500 mt-1">Raspberry Pi Exam Devices</p>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}