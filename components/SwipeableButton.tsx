import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, Check, Loader2 } from 'lucide-react';
import { playSound } from '../services/audio';

interface SwipeableButtonProps {
    onSwipeSuccess: () => void;
    isLoading?: boolean;
    label?: string;
    successLabel?: string;
    className?: string;
    color?: 'green' | 'red' | 'blue' | 'orange';
}

export const SwipeableButton: React.FC<SwipeableButtonProps> = ({
    onSwipeSuccess,
    isLoading = false,
    label = 'Deslize para confirmar',
    successLabel = 'Confirmado!',
    className = '',
    color = 'green'
}) => {
    const [dragWidth, setDragWidth] = useState(0);
    const [isSuccess, setIsSuccess] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const startX = useRef(0);

    // Configuration based on color prop
    const colors = {
        green: { bg: 'bg-green-500', text: 'text-green-500', container: 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800' },
        red: { bg: 'bg-red-500', text: 'text-red-500', container: 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800' },
        blue: { bg: 'bg-blue-500', text: 'text-blue-500', container: 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' },
        orange: { bg: 'bg-orange-500', text: 'text-orange-500', container: 'bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800' }
    };
    const theme = colors[color];

    // Touch Handlers
    const handleStart = (clientX: number) => {
        if (isLoading || isSuccess) return;
        isDragging.current = true;
        startX.current = clientX;
    };

    const handleMove = (clientX: number) => {
        if (!isDragging.current || !containerRef.current) return;
        const containerWidth = containerRef.current.clientWidth;
        const maxDrag = containerWidth - 56; // 56px roughly button width + padding

        let moveX = clientX - startX.current;
        if (moveX < 0) moveX = 0;
        if (moveX > maxDrag) moveX = maxDrag;

        setDragWidth(moveX);

        // Trigger success if dragged > 90%
        if (moveX > maxDrag * 0.9) {
            handleSuccess();
        }
    };

    const handleEnd = () => {
        isDragging.current = false;
        if (!isSuccess) {
            setDragWidth(0); // Reset if not fully swiped
        }
    };

    const handleSuccess = () => {
        if (isSuccess) return;
        setIsSuccess(true);
        isDragging.current = false;
        playSound('click'); // Or specific success sound
        if (navigator.vibrate) navigator.vibrate(50);
        onSwipeSuccess();
    };

    // Reset state if loading finishes and success is false (e.g. error)
    useEffect(() => {
        if (!isLoading && !isSuccess) {
            setDragWidth(0);
        }
    }, [isLoading]);

    return (
        <div
            ref={containerRef}
            className={`relative h-14 rounded-full overflow-hidden select-none border ${theme.container} ${className}`}
            onTouchStart={(e) => handleStart(e.touches[0].clientX)}
            onTouchMove={(e) => handleMove(e.touches[0].clientX)}
            onTouchEnd={handleEnd}
            onMouseDown={(e) => handleStart(e.clientX)}
            onMouseMove={(e) => isDragging.current && handleMove(e.clientX)}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
        >
            {/* Background Text */}
            <div className={`absolute inset-0 flex items-center justify-center font-bold text-sm uppercase tracking-wider transition-opacity duration-300 ${isSuccess || isLoading ? 'opacity-0' : 'opacity-100'} ${theme.text}`}>
                {label}
                <div className="absolute right-4 animate-pulse opacity-50">
                    <ChevronRight className="inline" size={16} />
                    <ChevronRight className="inline -ml-2" size={16} />
                    <ChevronRight className="inline -ml-2" size={16} />
                </div>
            </div>

            {/* Success/Loading Text */}
            <div className={`absolute inset-0 flex items-center justify-center font-bold text-white transition-opacity duration-300 ${isSuccess || isLoading ? 'opacity-100' : 'opacity-0'} z-10 pointer-events-none`}>
                {isLoading ? (
                    <div className="flex items-center gap-2">
                        <Loader2 className="animate-spin" size={20} />
                        <span>Processando...</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <Check size={20} strokeWidth={3} />
                        <span>{successLabel}</span>
                    </div>
                )}
            </div>

            {/* Draggable Knob */}
            <div
                className={`absolute top-1 bottom-1 left-1 w-12 rounded-full flex items-center justify-center shadow-md transition-all duration-75 cursor-pointer z-20 ${isLoading || isSuccess ? `w-[calc(100%-8px)] ${theme.bg}` : 'bg-white'}`}
                style={{ transform: `translateX(${isSuccess || isLoading ? 0 : dragWidth}px)` }}
            >
                {isLoading || isSuccess ? (
                    // Hidden content, controlled by parent container's centered text
                    null
                ) : (
                    <div className={`${theme.text}`}>
                        <ChevronRight size={24} strokeWidth={3} />
                    </div>
                )}
            </div>
        </div>
    );
};
