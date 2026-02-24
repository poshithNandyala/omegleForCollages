import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Users, MessageCircle, Shield, Video, Zap, Globe, ArrowRight } from 'lucide-react'
import { Button } from '../components/ui'
import useAuthStore from '../stores/authStore'
import api from '../lib/axios'

export default function Home() {
    const { isAuthenticated } = useAuthStore()
    const [onlineCount, setOnlineCount] = useState(0)

    useEffect(() => {
        api.get('/users/online-count').then(res => {
            setOnlineCount(res.data.data?.count || 0)
        }).catch(() => {})
    }, [])

    return (
        <div className="flex-1 flex flex-col min-h-screen bg-white dark:bg-zinc-950">
            {/* Hero */}
            <section className="flex-1 flex items-center">
                <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 py-24 lg:py-0 min-h-[calc(100vh-64px)] flex items-center">
                    <div className="w-full flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
                        {/* Left content */}
                        <div className="flex-1 max-w-2xl">
                            {onlineCount > 0 && (
                                <div className="inline-flex items-center gap-2.5 mb-8 px-4 py-2 bg-brand-light dark:bg-brand/10 rounded-full">
                                    <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                                    <span className="text-sm font-semibold text-brand dark:text-brand-light">{onlineCount} students online</span>
                                </div>
                            )}

                            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-dark dark:text-white leading-[1.05] tracking-tight">
                                Meet your<br />
                                <span className="text-brand">campus.</span>
                            </h1>
                            <p className="text-lg sm:text-xl text-slate-500 dark:text-zinc-400 mt-8 leading-relaxed max-w-lg">
                                Random video & text chat with verified college students. Your campus email is your ticket in.
                            </p>

                            <div className="flex flex-wrap items-center gap-4 mt-12">
                                {isAuthenticated ? (
                                    <Link to="/match">
                                        <Button size="lg" className="px-8 py-3 text-base">
                                            Start Matching <ArrowRight size={20} />
                                        </Button>
                                    </Link>
                                ) : (
                                    <>
                                        <Link to="/register">
                                            <Button size="lg" className="px-8 py-3 text-base">
                                                Get Started Free <ArrowRight size={20} />
                                            </Button>
                                        </Link>
                                        <Link to="/login">
                                            <Button variant="ghost" size="lg" className="px-8 py-3 text-base">
                                                Sign In
                                            </Button>
                                        </Link>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center gap-6 mt-12 text-sm text-slate-400 dark:text-zinc-500">
                                <div className="flex items-center gap-2">
                                    <Shield size={16} className="text-brand" />
                                    <span>College verified</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Zap size={16} className="text-brand" />
                                    <span>Instant matching</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Globe size={16} className="text-brand" />
                                    <span>Pan-India</span>
                                </div>
                            </div>
                        </div>

                        {/* Right feature grid */}
                        <div className="flex-1 w-full max-w-xl">
                            <div className="grid grid-cols-2 gap-5">
                                {[
                                    { icon: Shield, title: 'College Verified', desc: 'Only .edu & .ac.in emails allowed. Real students only.' },
                                    { icon: Video, title: 'Video Chat', desc: 'Face-to-face video calls with strangers on campus.' },
                                    { icon: MessageCircle, title: 'Text Chat', desc: 'Real-time messaging with typing indicators.' },
                                    { icon: Users, title: 'Smart Filters', desc: 'Filter matches by college, gender, or go random.' },
                                    { icon: Zap, title: 'Instant Match', desc: 'Get connected with someone in seconds.' },
                                    { icon: Globe, title: 'Campus Wide', desc: 'Students from colleges across India.' },
                                ].map(({ icon: Icon, title, desc }) => (
                                    <div
                                        key={title}
                                        className="bg-slate-50 dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-zinc-800 hover:border-brand/30 dark:hover:border-brand/30 hover:shadow-lg transition-all duration-200"
                                    >
                                        <div className="w-12 h-12 bg-brand-light dark:bg-brand/10 rounded-xl flex items-center justify-center mb-4">
                                            <Icon size={22} className="text-brand" />
                                        </div>
                                        <h3 className="font-bold text-dark dark:text-zinc-100 text-base">{title}</h3>
                                        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1.5 leading-relaxed">{desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}
