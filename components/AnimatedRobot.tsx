
import React from 'react';
import { motion } from 'framer-motion';

const AnimatedRobot: React.FC = () => {
  // Placeholder SVG or image for the robot
  // Replace this with your actual robot illustration or model
  return (
    <motion.div 
      className="w-full h-full flex items-center justify-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: "easeOut" }}
    >
      <svg 
        viewBox="0 0 200 200" 
        xmlns="http://www.w3.org/2000/svg" 
        className="w-3/4 h-3/4"
        aria-labelledby="robotTitle robotDesc"
        role="img"
      >
        <title id="robotTitle">Animated Robot</title>
        <desc id="robotDesc">A stylized illustration of a friendly robot.</desc>
        {/* Head */}
        <motion.rect 
          x="70" y="30" width="60" height="50" rx="10" fill="url(#robotGradientHead)"
          initial={{ y: 30 }}
          animate={{ y: [30, 28, 30] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        />
        {/* Eyes */}
        <motion.circle 
            cx="85" cy="55" r="5" fill="#FFF"
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.1, 1, 0.9, 1] }}
            transition={{ repeat: Infinity, duration: 3, delay: 0.2 }}
        />
        <motion.circle 
            cx="115" cy="55" r="5" fill="#FFF"
            initial={{ scale: 1 }}
            animate={{ scale: [1, 0.9, 1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 3, delay: 0.5 }}
        />
        {/* Body */}
        <motion.rect 
            x="50" y="80" width="100" height="70" rx="10" fill="url(#robotGradientBody)"
            initial={{ rotate: 0 }}
            animate={{ rotate: [0, 1, -1, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        />
        {/* Arms */}
        <motion.rect 
            x="30" y="90" width="20" height="40" rx="5" fill="url(#robotGradientArms)"
            initial={{ rotate: 0, originX: "40px", originY: "90px" }}
            animate={{ rotate: [0, -10, 0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
        />
        <motion.rect 
            x="150" y="90" width="20" height="40" rx="5" fill="url(#robotGradientArms)"
            initial={{ rotate: 0, originX: "160px", originY: "90px" }}
            animate={{ rotate: [0, 10, 0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", delay: 0.3 }}
        />
        {/* Legs */}
        <rect x="65" y="150" width="25" height="30" rx="5" fill="url(#robotGradientLegs)" />
        <rect x="110" y="150" width="25" height="30" rx="5" fill="url(#robotGradientLegs)" />
        
        <defs>
          <linearGradient id="robotGradientHead" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{stopColor:"#FBBF24", stopOpacity:1}} />
            <stop offset="100%" style={{stopColor:"#F59E0B", stopOpacity:1}} />
          </linearGradient>
           <linearGradient id="robotGradientBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{stopColor:"#60A5FA", stopOpacity:1}} />
            <stop offset="100%" style={{stopColor:"#3B82F6", stopOpacity:1}} />
          </linearGradient>
          <linearGradient id="robotGradientArms" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{stopColor:"#A78BFA", stopOpacity:1}} />
            <stop offset="100%" style={{stopColor:"#8B5CF6", stopOpacity:1}} />
          </linearGradient>
          <linearGradient id="robotGradientLegs" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{stopColor:"#78716C", stopOpacity:1}} />
            <stop offset="100%" style={{stopColor:"#57534E", stopOpacity:1}} />
          </linearGradient>
        </defs>
      </svg>
    </motion.div>
  );
};

export default AnimatedRobot;
