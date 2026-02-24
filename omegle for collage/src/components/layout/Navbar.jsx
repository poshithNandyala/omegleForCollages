import { Link, useNavigate } from 'react-router-dom'
import { LogOut, User, Zap, Sun, Moon } from 'lucide-react'
import useAuthStore from '../../stores/authStore'
import useThemeStore from '../../stores/themeStore'

export default function Navbar() {
    const { user, isAuthenticated, logout } = useAuthStore()
    const { theme, toggleTheme } = useThemeStore()
    const navigate = useNavigate()

    const handleLogout = async () => {
        await logout()
        navigate('/login')
    }

    return (
        <nav className="sticky top-0 z-50 bg-dark dark:bg-zinc-900 text-white border-b border-transparent dark:border-zinc-800">
            <div className="w-full max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center">
                        <Zap size={16} className="text-white" />
                    </div>
                    <span className="text-lg font-bold tracking-tight">CampusConnect</span>
                </Link>

                <div className="flex items-center gap-3">
                    <button
                        onClick={toggleTheme}
                        className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                    >
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>

                    {isAuthenticated ? (
                        <>
                            <Link to="/match" className="hidden sm:block px-5 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-lg text-sm font-semibold transition-colors">
                                Start Matching
                            </Link>
                            <Link to="/match" className="sm:hidden px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg text-sm font-semibold transition-colors">
                                Match
                            </Link>
                            <Link to="/profile" className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors">
                                {user?.avatar ? (
                                    <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-white/20" />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-brand-light flex items-center justify-center">
                                        <User size={16} className="text-brand" />
                                    </div>
                                )}
                                <span className="text-sm font-medium hidden md:block">{user?.fullName?.split(' ')[0]}</span>
                            </Link>
                            <button onClick={handleLogout} className="p-2 text-white/50 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors" title="Logout">
                                <LogOut size={18} />
                            </button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors">
                                Sign In
                            </Link>
                            <Link to="/register" className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-lg text-sm font-semibold transition-colors">
                                Get Started
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    )
}
