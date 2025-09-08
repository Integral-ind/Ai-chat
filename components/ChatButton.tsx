import React from 'react';
import { motion } from 'framer-motion';

interface ChatButtonProps {
  onClick: () => void;
  hasUnreadMessages?: boolean;
}

const ChatButton: React.FC<ChatButtonProps> = ({ onClick, hasUnreadMessages = false }) => {
  return (
    <motion.button
      onClick={onClick}
      className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-primary to-indigo-600 dark:from-indigo-500 dark:to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-40 group"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      {/* Notification indicator */}
      {hasUnreadMessages && (
        <motion.div
          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-gray-800"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
        />
      )}

      {/* Chat icon */}
      <div className="flex items-center justify-center w-full h-full">
        <motion.svg
          className="w-6 h-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          initial={false}
          animate={{ rotate: hasUnreadMessages ? [0, -10, 10, 0] : 0 }}
          transition={{ repeat: hasUnreadMessages ? Infinity : 0, duration: 0.5 }}
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          <path d="M8 10h.01M12 10h.01M16 10h.01"/>
        </motion.svg>
      </div>

      {/* Ripple effect */}
      <motion.div
        className="absolute inset-0 bg-white/20 rounded-full"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1.5, opacity: 0 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'easeOut' }}
      />

      {/* Hover tooltip */}
      <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
        Chat with AI Assistant
        <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-100"></div>
      </div>
    </motion.button>
  );
};

export default ChatButton;