import type { Section } from '../types'

type NavItem = {
  id: Section
  label: string
  icon: string
}

type SidebarNavProps = {
  activeSection: Section
  items: NavItem[]
  onSectionChange: (section: Section) => void
}

export function SidebarNav({
  activeSection,
  items,
  onSectionChange,
}: SidebarNavProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-icon">M</span>
        <div>
          <strong>Moon Agent</strong>
          <small>AI Planning Assistant</small>
        </div>
      </div>
      <nav>
        {items.map((item) => (
          <button
            className={activeSection === item.id ? 'nav-item active' : 'nav-item'}
            key={item.id}
            onClick={() => onSectionChange(item.id)}
            type="button"
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
