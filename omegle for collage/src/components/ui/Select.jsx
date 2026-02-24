import { forwardRef } from 'react'

const Select = forwardRef(({ label, error, options, placeholder, className = '', ...props }, ref) => {
    return (
        <div className="w-full">
            {label && <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">{label}</label>}
            <select
                ref={ref}
                className={`w-full h-11 px-4 border rounded-lg text-sm bg-white dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-600 transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand appearance-none ${error ? 'border-red-400' : 'border-gray-300'} ${className}`}
                {...props}
            >
                {placeholder && <option value="">{placeholder}</option>}
                {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
        </div>
    )
})

Select.displayName = 'Select'
export default Select
