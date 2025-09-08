import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from './icons/XIcon';

interface WelcomeNotificationProps {
  message: string;
  show: boolean;
  onDismiss: () => void;
  duration?: number;
}

export const WelcomeNotification: React.FC<WelcomeNotificationProps> = ({
  message,
  show,
  onDismiss,
  duration = 7000,
}) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onDismiss]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9, transition: { duration: 0.2 } }}
          className="fixed top-4 right-4 z-[99999] w-full max-w-sm p-4 bg-card dark:bg-card-dark text-text dark:text-text-dark rounded-lg shadow-2xl border border-border dark:border-border-dark"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start">
            <div className="flex-shrink-0 pt-0.5">
              <svg className="h-6 w-6 text-primary dark:text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
            </div>
            <div className="ml-3 w-0 flex-1">
              <p className="text-sm font-medium">Welcome to Integral!</p>
              <p className="mt-1 text-sm text-muted dark:text-muted-dark">{message}</p>
            </div>
            <div className="ml-4 flex-shrink-0 flex">
              <button
                type="button"
                className="inline-flex rounded-md bg-card dark:bg-card-dark text-muted dark:text-muted-dark hover:text-text dark:hover:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-light dark:focus:ring-primary-dark focus:ring-offset-2 dark:focus:ring-offset-card-dark"
                onClick={onDismiss}
                aria-label="Dismiss notification"
              >
                <span className="sr-only">Dismiss</span>
                <XIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
