import { NavLink } from 'react-router-dom'

function Icon({ path, className = 'w-4 h-4' }: { path: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={path} />
    </svg>
  )
}

const ICONS = {
  devices: 'M4 6h16v10H4V6Zm4 14h8M12 16v4',
  exams: 'M9 12h6M9 16h6M9 8h1M4 4h16v16H4V4Z',
}

export function Sidebar() {
  const navItems = [
    { to: '/devices', label: 'Devices', icon: ICONS.devices },
    { to: '/exams', label: 'Exam Control', icon: ICONS.exams },
  ]

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen p-4 flex flex-col">
      <div className="mb-8 px-2 pt-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Icon path="M12 2 3 7l9 5 9-5-9-5ZM3 12l9 5 9-5M3 17l9 5 9-5" className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-gray-900 leading-tight">Device Management</h1>
            <p className="text-xs text-gray-400 leading-tight">Raspberry Pi Exam Devices</p>
          </div>
        </div>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon path={item.icon} className={`w-[18px] h-[18px] ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}