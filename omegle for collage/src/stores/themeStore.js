import { create } from 'zustand'

const useThemeStore = create((set) => ({
    theme: localStorage.getItem('theme') || 'light',

    toggleTheme: () => set((state) => {
        const next = state.theme === 'light' ? 'dark' : 'light'
        localStorage.setItem('theme', next)
        document.documentElement.classList.toggle('dark', next === 'dark')
        return { theme: next }
    }),

    initTheme: () => {
        const saved = localStorage.getItem('theme') || 'light'
        document.documentElement.classList.toggle('dark', saved === 'dark')
        set({ theme: saved })
    }
}))

export default useThemeStore
