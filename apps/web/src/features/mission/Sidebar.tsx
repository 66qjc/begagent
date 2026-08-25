import { Archive, BriefcaseBusiness, Database, FileCheck2, LayoutDashboard, MemoryStick, ServerCog } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface NavItem {
  icon: LucideIcon
  label: string
  active?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: '任务工作台', active: true },
  { icon: BriefcaseBusiness, label: '岗位机会' },
  { icon: MemoryStick, label: '职业记忆' },
  { icon: FileCheck2, label: '证据与简历' },
  { icon: Archive, label: '历史任务' },
]

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand-lockup"><span className="brand-symbol">启</span><strong>启程</strong><small>Career OS</small></div>
      <nav aria-label="主导航">
        {NAV_ITEMS.map(({ icon: Icon, label, active }) => (
          <button aria-label={label} className={active ? 'nav-item is-active' : 'nav-item'} key={label} type="button">
            <Icon size={18} /><span>{label}</span>{active ? <span className="nav-pip" /> : null}
          </button>
        ))}
      </nav>
      <div className="sidebar-runtime">
        <div><Database size={16} /><span><strong>Career DB</strong><small>SQLite · 已连接</small></span></div>
        <div><ServerCog size={16} /><span><strong>Agent Runtime</strong><small>Keyless · 本地</small></span></div>
      </div>
    </aside>
  )
}
