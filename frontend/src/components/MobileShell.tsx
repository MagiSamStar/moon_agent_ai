import type { ReactNode } from 'react'
import type { MobileTab } from '../types'

type MobileNavItem = {
  id: MobileTab
  label: string
  icon: string
}

type MobileShellProps = {
  activeTab: MobileTab
  children: ReactNode
  items: MobileNavItem[]
  title: string
  onTabChange: (tab: MobileTab) => void
}

export function MobileShell({
  activeTab,
  children,
  items,
  title,
  onTabChange,
}: MobileShellProps) {
  return (
    <main className="mobile-shell">
      <header className="mobile-topbar">
        <span>Moon Agent</span>
        <h1>{title}</h1>
        <button aria-label="Information" type="button">
          i
        </button>
      </header>
      <section className="mobile-content">{children}</section>
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {items.map((item) => (
          <button
            className={activeTab === item.id ? 'active' : ''}
            key={item.id}
            onClick={() => onTabChange(item.id)}
            type="button"
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </main>
  )
}
