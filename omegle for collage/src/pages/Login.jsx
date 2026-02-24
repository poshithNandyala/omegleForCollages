import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Zap } from 'lucide-react'
import { Input, Button } from '../components/ui'
import useAuthStore from '../stores/authStore'

export default function Login() {
    const [formData, setFormData] = useState({ email: '', password: '' })
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const { login } = useAuthStore()
    const navigate = useNavigate()
    const location = useLocation()
    const from = location.state?.from?.pathname || '/match'

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            await login(formData)
            toast.success('Welcome back!')
            navigate(from, { replace: true })
        } catch (error) {
            toast.error(error.response?.data?.message || 'Login failed')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex-1 flex min-h-screen">
            {/* Left branding panel */}
            <div className="hidden lg:flex flex-1 bg-dark items-center justify-center p-16 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(124,58,237,0.12),transparent_60%)]" />
                <div className="relative max-w-md text-center">
                    <div className="w-20 h-20 bg-brand rounded-2xl flex items-center justify-center mx-auto mb-10 shadow-[0_0_40px_rgba(124,58,237,0.3)]">
                        <Zap size={36} className="text-white" />
                    </div>
                    <h2 className="text-4xl font-bold text-white mb-5">CampusConnect</h2>
                    <p className="text-slate-400 text-lg leading-relaxed">
                        Meet verified college students through random video and text chat. Safe, fun, and exclusive to your campus.
                    </p>
                    <div className="flex items-center justify-center gap-8 mt-12 text-sm text-slate-500">
                        <div className="flex flex-col items-center gap-1.5">
                            <span className="text-2xl font-bold text-white">10K+</span>
                            <span>Students</span>
                        </div>
                        <div className="w-px h-10 bg-slate-700" />
                        <div className="flex flex-col items-center gap-1.5">
                            <span className="text-2xl font-bold text-white">50+</span>
                            <span>Colleges</span>
                        </div>
                        <div className="w-px h-10 bg-slate-700" />
                        <div className="flex flex-col items-center gap-1.5">
                            <span className="text-2xl font-bold text-white">100%</span>
                            <span>Verified</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right form panel */}
            <div className="flex-1 flex items-center justify-center p-8 sm:p-16 bg-white dark:bg-zinc-950">
                <div className="w-full max-w-md">
                    <div className="lg:hidden flex items-center gap-3 mb-10">
                        <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center">
                            <Zap size={20} className="text-white" />
                        </div>
                        <span className="text-xl font-bold text-dark dark:text-white">CampusConnect</span>
                    </div>

                    <div className="mb-10">
                        <h1 className="text-3xl sm:text-4xl font-bold text-dark dark:text-white">Welcome back</h1>
                        <p className="text-slate-500 dark:text-zinc-400 mt-3 text-base">Sign in to continue to CampusConnect</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <Input
                            label="Email"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="you@college.ac.in"
                            required
                        />

                        <div className="relative">
                            <Input
                                label="Password"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Enter your password"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>

                        <Button type="submit" loading={isLoading} className="w-full py-3 text-base">
                            Sign In
                        </Button>
                    </form>

                    <p className="text-center text-sm text-slate-500 dark:text-zinc-400 mt-10">
                        Don't have an account?{' '}
                        <Link to="/register" className="text-brand font-semibold hover:underline">
                            Create one
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
