export default function Card({ children, className = '', onClick, hover = false }) {
    return (
        <div
            className={`bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 ${hover ? 'hover:border-brand/30 hover:shadow-md transition-all cursor-pointer' : ''} ${className}`}
            onClick={onClick}
        >
            {children}
        </div>
    )
}
