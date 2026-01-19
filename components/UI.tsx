import React from 'react';
import { Loader2 } from 'lucide-react';

export const Button = ({
  children,
  onClick,
  variant = 'primary',
  className = '',
  isLoading = false,
  fullWidth = false,
  disabled = false,
  style
}: {
  children?: React.ReactNode;
  onClick?: (e?: any) => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success';
  className?: string;
  isLoading?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
}) => {
  const baseStyle = "px-4 py-2 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:pointer-events-none";

  const variants = {
    primary: "bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/20",
    secondary: "bg-gray-800 text-white hover:bg-gray-900",
    outline: "border-2 border-gray-200 text-gray-700 hover:bg-gray-50",
    danger: "bg-red-500 text-white hover:bg-red-600",
    success: "bg-green-500 text-white hover:bg-green-600"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`${baseStyle} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      style={style}
    >
      {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
      {children}
    </button>
  );
};

export const Input = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  icon,
  readOnly = false,
  className = '',
  ...props
}: {
  label?: string;
  value: any;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ReactNode;
  readOnly?: boolean;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className={`w-full ${className}`}>
    {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full p-3 ${icon ? 'pl-10' : ''} bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all ${readOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
        {...props}
      />
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          {icon}
        </div>
      )}
    </div>
  </div>
);

export const Card: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 ${className}`}>
    {children}
  </div>
);

export const Badge = ({ children, color = 'gray', size = 'md', className = '' }: { children?: React.ReactNode; color?: string; size?: 'sm' | 'md' | 'lg'; className?: string }) => {
  const colors: { [key: string]: string } = {
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
    orange: 'bg-orange-100 text-orange-700',
    gray: 'bg-gray-100 text-gray-700',
  };

  const sizes = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5'
  };

  return (
    <span className={`rounded-full font-medium ${sizes[size] || sizes.md} ${colors[color] || colors.gray} ${className}`}>
      {children}
    </span>
  );
};