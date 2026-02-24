import { create } from 'zustand'
import api from '../lib/axios'
import { connectSocket, disconnectSocket } from '../lib/socket'

const useAuthStore = create((set, get) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,

    login: async (credentials) => {
        const response = await api.post('/users/login', credentials)
        const { user, accessToken, refreshToken } = response.data.data
        localStorage.setItem('accessToken', accessToken)
        localStorage.setItem('refreshToken', refreshToken)
        connectSocket(accessToken)
        set({ user, isAuthenticated: true, isLoading: false })
        return response.data
    },

    register: async (formData) => {
        const response = await api.post('/users/register', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
        return response.data
    },

    logout: async () => {
        try { await api.post('/users/logout') } catch {}
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        disconnectSocket()
        set({ user: null, isAuthenticated: false })
    },

    checkAuth: async () => {
        const token = localStorage.getItem('accessToken')
        if (!token) { set({ isLoading: false }); return }
        try {
            const response = await api.get('/users/me')
            connectSocket(token)
            set({ user: response.data.data, isAuthenticated: true, isLoading: false })
        } catch {
            localStorage.removeItem('accessToken')
            localStorage.removeItem('refreshToken')
            set({ user: null, isAuthenticated: false, isLoading: false })
        }
    },

    updateUser: (userData) => set({ user: { ...get().user, ...userData } })
}))

export default useAuthStore
