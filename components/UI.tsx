import React from 'react';
import { Loader2, Eye, EyeOff, Info } from 'lucide-react';

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
  error,
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
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) => {
  const [showPassword, setShowPassword] = React.useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;
  const hasError = !!error;

  return (
    <div className={`w-full ${className}`}>
      {label && <label className={`block text-sm font-medium mb-1 ${hasError ? 'text-red-600' : 'text-gray-700'}`}>{label}</label>}
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          readOnly={readOnly}
          className={`w-full p-3 ${icon ? 'pl-10' : ''} ${isPassword ? 'pr-12' : ''} bg-gray-50 border rounded-xl outline-none transition-all ${hasError
            ? 'border-red-500 focus:ring-2 focus:ring-red-400 focus:border-transparent bg-red-50/30'
            : 'border-gray-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent'
            } ${readOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
          {...props}
        />
        {icon && (
          <div className={`absolute left-3 top-1/2 -translate-y-1/2 ${hasError ? 'text-red-400' : 'text-gray-400'}`}>
            {icon}
          </div>
        )}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {hasError && (
        <p className="mt-1 text-xs font-medium text-red-600 flex items-center gap-1">
          <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
          {error}
        </p>
      )}
    </div>
  );
};

export const Card: React.FC<{ children?: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 ${className}`} {...props}>
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

// --- Confirmation Modal ---
// --- Confirmation Modal ---
export const ConfirmationModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  singleButton = false
}: {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'info' | 'success';
  singleButton?: boolean;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={singleButton ? onConfirm : onCancel}
      ></div>

      {/* Modal Content */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative z-10 animate-scale-up border border-gray-100">
        <div className="text-center">
          {/* Icon based on variant */}
          <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${variant === 'danger' ? 'bg-red-100 text-red-600' :
            variant === 'success' ? 'bg-green-100 text-green-600' :
              'bg-blue-100 text-blue-600'
            }`}>
            {variant === 'danger' ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : variant === 'success' ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>

          <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-500 mb-6">{message}</p>

          <div className="flex gap-3 justify-center">
            {!singleButton && (
              <Button
                variant="outline"
                onClick={onCancel}
                className="flex-1"
              >
                {cancelText}
              </Button>
            )}
            <Button
              variant={variant === 'danger' ? 'danger' : 'primary'}
              onClick={onConfirm}
              className="flex-1"
            >
              {singleButton && confirmText === 'Confirmar' ? 'OK' : confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};