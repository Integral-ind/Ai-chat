
import React from 'react';
import { motion, Variants } from 'framer-motion';

interface AnimatedTextProps {
  text: string;
  className?: string;
  fontSize?: string; // e.g., "text-4xl"
}

const AnimatedText: React.FC<AnimatedTextProps> = ({ text, className = '', fontSize = 'text-6xl' }) => {
  const words = text.split(" ");

  const container: Variants = {
    hidden: { opacity: 0 },
    visible: (i = 1) => ({
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.04 * i },
    }),
  };

  const child: Variants = {
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        type: "spring" as const,
        damping: 12,
        stiffness: 100,
      },
    },
    hidden: {
      opacity: 0,
      x: 20,
      transition: {
        type: "spring" as const,
        damping: 12,
        stiffness: 100,
      },
    },
  };

  return (
    <motion.div
      style={{ display: "flex", overflow: "hidden" }}
      variants={container}
      initial="hidden"
      animate="visible"
      className={`${className} ${fontSize} font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-amber-500 to-orange-500`}
      aria-label={text}
    >
      {words.map((word, index) => (
        <motion.span
          key={index}
          variants={child}
          style={{ marginRight: "0.25em" }} // Adjust spacing between words
          aria-hidden="true" // Hide from screen readers as the parent div has aria-label
        >
          {word}
        </motion.span>
      ))}
    </motion.div>
  );
};

export default AnimatedText;