import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { Layout, ProtectedRoute } from './components/layout'
import useAuthStore from './stores/authStore'
import useThemeStore from './stores/themeStore'
import { PageLoader } from './components/ui/Loader'

import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Match from './pages/Match'
import Profile from './pages/Profile'

export default function App() {
    const { checkAuth, isLoading } = useAuthStore()
    const { initTheme } = useThemeStore()

    useEffect(() => {
        initTheme()
        checkAuth()
    }, [])

    if (isLoading) return <PageLoader />

    return (
        <BrowserRouter>
            <Toaster
                position="top-center"
                toastOptions={{
                    duration: 3000,
                    style: {
                        borderRadius: '12px',
                        background: '#1f2937',
                        color: '#fff',
                        fontSize: '14px',
                    },
                }}
            />
            <Routes>
                <Route element={<Layout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/match" element={
                        <ProtectedRoute><Match /></ProtectedRoute>
                    } />
                    <Route path="/profile" element={
                        <ProtectedRoute><Profile /></ProtectedRoute>
                    } />
                </Route>
            </Routes>
        </BrowserRouter>
    )
}
