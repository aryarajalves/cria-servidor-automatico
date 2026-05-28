import React from 'react';
import { Loader2 } from 'lucide-react';

const Button = ({ children, isLoading, variant = 'primary', className = '', ...props }) => {
    const baseStyles = "flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.03] active:scale-[0.97] hover:ring-2 hover:ring-offset-2 hover:ring-offset-slate-900";

    const variants = {
        primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 hover:ring-blue-500",
        secondary: "bg-slate-700 hover:bg-slate-600 text-white hover:ring-slate-500",
        danger: "bg-red-600 hover:bg-red-500 text-white hover:ring-red-500",
        ghost: "bg-transparent hover:bg-slate-800 text-slate-300 hover:ring-slate-700",
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${className}`}
            disabled={isLoading}
            {...props}
        >
            {isLoading && <Loader2 className="animate-spin" size={18} />}
            {children}
        </button>
    );
};

export default Button;
