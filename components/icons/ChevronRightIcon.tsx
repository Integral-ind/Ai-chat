
import React from 'react';

interface ChevronRightIconProps {
  className?: string;
  size?: number; // Optional size prop
}

export const ChevronRightIcon: React.FC<ChevronRightIconProps> = ({ className, size }) => {
  const iconSize = size ? `${size}px` : '1em'; // Default to 1em if size is not provided
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24" 
      strokeWidth={1.5} 
      stroke="currentColor" 
      className={className || "w-6 h-6"} // Default Tailwind classes if no className prop
      style={size ? { width: iconSize, height: iconSize } : {}}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
};
