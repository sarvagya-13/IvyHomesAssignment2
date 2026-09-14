import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSaved } from '../context/SavedContext';

const links = [
  { to: '/listings', label: 'Buy' },
  { to: '/rentals', label: 'Rent' },
  { to: '/projects', label: 'Projects' },
  { to: '/saved', label: 'Saved' },
  { to: '/insights', label: 'Insights' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const { count } = useSaved();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <NavLink to="/listings" className="flex items-baseline gap-1.5">
            <span className="font-display text-xl font-semibold tracking-tight text-moss-700">Ivy</span>
            <span className="font-display text-xl text-ink">Homes</span>
            <span className="ml-1 hidden text-[11px] uppercase tracking-widest text-ink-soft sm:inline">Pune</span>
          </NavLink>

          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) => `relative whitespace-nowrap rounded-card px-3 py-1.5 text-sm transition-colors ${
                  isActive ? 'bg-moss-50 font-medium text-moss-700' : 'text-ink-muted hover:bg-paper-sunk hover:text-ink'
                }`}
              >
                {l.label}
                {l.to === '/saved' && count > 0 && (
                  <span className="ml-1.5 rounded-full bg-moss-600 px-1.5 py-px text-[10px] font-medium text-white">{count}</span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-ink-muted sm:inline">{user?.name}</span>
            <button
              type="button"
              className="btn-ghost py-1 text-xs"
              onClick={async () => { await logout(); navigate('/login'); }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-paper-sunk">
        <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-ink-soft">
          <p>
            Figures are computed from a corrected snapshot of the Ivy Homes API. Areas reported in square metres have been
            converted, project prices rescaled from lakhs and crores, and listings we believe to be bait are labelled.
          </p>
          <p className="mt-1">See the Insights screen for what was wrong and how it was found.</p>
        </div>
      </footer>
    </div>
  );
}
