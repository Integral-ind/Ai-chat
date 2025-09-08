
import React from 'react';
import { motion, Variants } from 'framer-motion';

const MissionVisualization: React.FC = () => {
  // This is a conceptual placeholder. You'd replace this with a more sophisticated SVG or canvas animation.
  const items = [
    { id: 1, label: 'Idea', color: 'bg-sky-500' },
    { id: 2, label: 'Plan', color: 'bg-indigo-500' },
    { id: 3, label: 'Execute', color: 'bg-purple-500' },
    { id: 4, label: 'Achieve', color: 'bg-amber-500' },
  ];

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.3,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring' as const, stiffness: 100 },
    },
  };

  return (
    <div className="mt-8 p-6 bg-gray-800 rounded-xl border border-gray-700">
      <h4 className="text-xl font-semibold text-center mb-6 text-amber-300">Our Process to Empowerment</h4>
      <motion.div 
        className="flex flex-col sm:flex-row justify-around items-center space-y-4 sm:space-y-0 sm:space-x-4"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.5 }}
      >
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            <motion.div
              variants={itemVariants}
              className="flex flex-col items-center"
            >
              <div className={`w-16 h-16 rounded-full ${item.color} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                {item.id}
              </div>
              <p className="mt-2 text-sm text-gray-300">{item.label}</p>
            </motion.div>
            {index < items.length - 1 && (
              <motion.div 
                variants={itemVariants}
                className="hidden sm:block h-1 w-12 bg-gray-600 rounded-full" // Connector line for larger screens
              />
            )}
             {index < items.length - 1 && (
              <motion.div 
                variants={itemVariants}
                className="sm:hidden w-1 h-8 bg-gray-600 rounded-full" // Vertical connector line for smaller screens
              />
            )}
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
};

export default MissionVisualization;