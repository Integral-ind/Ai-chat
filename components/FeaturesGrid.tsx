
import React from 'react';
import { motion } from 'framer-motion';
// Icons are no longer used here directly, but types.ts defines Feature
import { Feature } from '../types'; 

interface FeaturesGridProps {
  features: Feature[];
}

const FeaturesGrid: React.FC<FeaturesGridProps> = ({ features }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {features.map((feature, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          viewport={{ once: true }}
          className="bg-gray-800 bg-opacity-50 backdrop-blur-md p-6 rounded-xl border border-gray-700 shadow-lg hover:shadow-amber-500/20 transition-shadow"
        >
          {/* Icon rendering removed as iconName is no longer in Feature type */}
          {/* 
          <div className="flex items-center justify-center w-16 h-16 mb-6 bg-amber-500 bg-opacity-10 rounded-full">
            {getIconComponent(feature.iconName)}
          </div> 
          */}
          <h3 className="text-xl font-semibold mb-3 text-white mt-2">{feature.title}</h3> {/* Added mt-2 for spacing if icons were present */}
          <p className="text-gray-400 leading-relaxed">{feature.description}</p>
        </motion.div>
      ))}
    </div>
  );
};

export default FeaturesGrid;
