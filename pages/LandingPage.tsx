
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
// Adjusted import for Button as it's likely in ../components not ../components/Button
import { Button } from "../components"; 
import { ChevronRightIcon } from "../components/icons/ChevronRightIcon";
import { CheckCircleIcon } from "../components/icons/CheckCircleIcon";
import Navbar from "../components/Navbar";
import AnimatedBackground from "../components/AnimatedBackground";
import AnimatedRobot from "../components/AnimatedRobot";
import AnimatedText from "../components/AnimatedText";
import MissionVisualization from "../components/MissionVisualization";
import FeaturesGrid from "../components/FeaturesGrid";
import { FEATURES_DATA } from "../constants"; // Ensure FEATURES_DATA is in constants

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);


  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (!isMounted) {
    return null; // Or a loading spinner
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <Navbar />

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden pt-20 md:pt-24"> {/* Adjusted pt for Navbar height */}
        <AnimatedBackground />
        <div className="container relative z-10 px-4 mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center lg:text-left"
            >
              <AnimatedText text="Integral" className="mb-8 md:mb-10" fontSize="text-7xl sm:text-8xl" />
              <motion.h1 
                initial={{ opacity: 0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.5, duration:0.5}}
                className="text-4xl md:text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-amber-600">
                Your Complete Workspace Solution
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.7, duration:0.5}}
                className="text-lg md:text-xl mb-8 text-gray-300">
                Empower yourself to work seamlessly through all domains with a single integrated platform.
              </motion.p>
              <motion.div 
                initial={{ opacity: 0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.9, duration:0.5}}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button
                  onClick={() => navigate("/signup")}
                  size="lg"
                  className="bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white shadow-lg hover:shadow-amber-500/50"
                  aria-label="Get started for free"
                >
                  Get Started Free <ChevronRightIcon className="ml-2 h-4 w-4" />
                </Button>
                <Button onClick={() => scrollToSection('features')} variant="outline" size="lg" className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:border-amber-500" aria-label="Learn more about features">
                  Learn More
                </Button>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="hidden lg:block h-[400px] md:h-[500px]"
            >
              <AnimatedRobot />
            </motion.div>
          </div>
        </div>
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-10">
          <motion.button
            onClick={() => scrollToSection('features')}
            animate={{ y: [0, 10, 0] }} 
            transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2 }}
            className="cursor-pointer p-2"
            aria-label="Scroll to features section"
            >
            <ChevronRightIcon size={30} className="rotate-90 text-gray-400 hover:text-amber-400" />
          </motion.button>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gradient-to-b from-black to-gray-900">
        <div className="container px-4 mx-auto">
          <div className="text-center mb-16">
            <motion.h2
              initial={{ opacity: 0, y:20 }}
              whileInView={{ opacity: 1, y:0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="text-4xl sm:text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-amber-600"
            >
              Everything You Need, All In One Place
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y:20 }}
              whileInView={{ opacity: 1, y:0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
              className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto"
            >
              Integral brings together all your tasks, resources, and tools in a single unified workspace, designed to
              boost your productivity and streamline your workflow.
            </motion.p>
          </div>
          <FeaturesGrid features={FEATURES_DATA} />
        </div>
      </section>

      {/* About/Mission Section */}
      <section id="about" className="py-20 bg-gray-900">
        <div className="container px-4 mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="lg:w-1/2"
            >
              <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-amber-400">Our Mission</h2>
              <p className="text-lg text-gray-300 mb-6 leading-relaxed">
                We aim to boost productivity for students and professionals, assisting them to manage end-to-end
                tasks with ease. Our mission is to aid individuals and groups cut through distractions, achieve their
                tasks and be a better version of themselves.
              </p>
              <MissionVisualization />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="lg:w-1/2"
            >
              <div className="bg-gray-800 bg-opacity-50 backdrop-blur-lg rounded-xl p-8 border border-gray-700 shadow-xl">
                <h3 className="text-2xl sm:text-3xl font-bold mb-6 text-amber-500">What Differentiates Us?</h3>
                <ul className="space-y-6">
                  {[
                    { title: "A Complete Integration", text: "Integral covers both self & group management along with the integration of whatever a digital-desk may require." },
                    { title: "Easy-to-use Interface", text: "Designed from its core to have complex features in a simple interface which is instant and intuitive." },
                    { title: "Friendly Motivation", text: "A friendly and pushing environment through a fictional mascot character who is a friend to the user." },
                  ].map((item, index) => (
                     <motion.li 
                        key={index} 
                        className="flex gap-4 items-start"
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        viewport={{ once: true }}
                      >
                      <CheckCircleIcon className="h-7 w-7 text-amber-400 flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="font-bold text-xl text-white">{item.title}</h4>
                        <p className="text-gray-400">{item.text}</p>
                      </div>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-black">
        <div className="container px-4 mx-auto">
          <div className="text-center mb-16">
            <motion.h2
              initial={{ opacity: 0, y:20 }}
              whileInView={{ opacity: 1, y:0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="text-4xl sm:text-5xl font-bold mb-4 text-white"
            >
              Choose Your Plan
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y:20 }}
              whileInView={{ opacity: 1, y:0 }}
              transition={{ duration: 0.5, delay:0.2 }}
              viewport={{ once: true }}
              className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto"
            >
              Start with our free plan and upgrade as your needs grow. Simple, transparent pricing.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              {
                title: "Free",
                price: "₹0",
                description: "Perfect for getting started",
                features: [
                  "Cloud storage up to 5 GB",
                  "Limited Self Analysis",
                  "Mascot feature",
                  "Limited APIs use",
                  "Interactive Task board, Calendar, Notes",
                ],
                cta: "Get Started",
                popular: false,
                ariaLabel: "Select Free Plan"
              },
              {
                title: "Premium",
                price: "₹49",
                description: "For power users and teams",
                features: [
                  "Cloud storage up to 50 GB",
                  "Complete Self Analysis",
                  "AI suggestions and scheduling",
                  "Unlimited Projects, API usage",
                  "Unlimited Chat/Meet feature",
                ],
                cta: "Upgrade Now",
                popular: true,
                ariaLabel: "Select Premium Plan"
              },
            ].map((plan, index) => (
              <motion.div
                key={plan.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className={`bg-gray-800 bg-opacity-70 backdrop-blur-lg rounded-xl p-8 border border-gray-700 shadow-2xl relative transform hover:scale-105 transition-transform duration-300 ${plan.popular ? 'border-amber-500 ring-2 ring-amber-500' : 'hover:border-amber-400'}`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-amber-500 text-white px-4 py-1 text-sm font-bold rounded-bl-lg rounded-tr-lg">POPULAR</div>
                )}
                <h3 className={`text-2xl font-bold mb-2 ${plan.popular ? 'text-amber-400' : 'text-white'}`}>{plan.title}</h3>
                <p className="text-gray-400 mb-6">{plan.description}</p>
                <div className="text-4xl font-bold mb-6 text-white">
                  {plan.price} <span className="text-lg font-normal text-gray-400">/month</span>
                </div>
                <ul className="space-y-3 mb-8" aria-label={`Features for ${plan.title} plan`}>
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-300">
                      <CheckCircleIcon className={`h-5 w-5 ${plan.popular ? 'text-amber-400' : 'text-emerald-400'}`} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => navigate("/signup")}
                  className={`w-full font-semibold ${plan.popular ? 'bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white shadow-lg hover:shadow-amber-500/50' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                  aria-label={plan.ariaLabel}
                >
                  {plan.cta}
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-t from-black via-gray-900 to-gray-900">
        <div className="container px-4 mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-white">Ready to Transform Your Productivity?</h2>
            <p className="text-lg md:text-xl text-gray-300 mb-8">
              Join thousands of students and professionals who have already improved their workflow with Integral.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate("/signup")}
                size="lg"
                className="bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white shadow-lg hover:shadow-amber-500/50"
                aria-label="Get started for free"
              >
                Get Started Free
              </Button>
              <Button
                onClick={() => navigate("/signin")}
                variant="outline"
                size="lg"
                className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:border-amber-500"
                aria-label="Sign in to your account"
              >
                Sign In
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer / Contact Section */}
      <footer id="contact" className="py-12 bg-black border-t border-gray-800">
        <div className="container px-4 mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center text-center md:text-left">
            <div className="mb-6 md:mb-0">
               <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-amber-600 mb-2 inline-block">
                Integral
              </span>
              <p className="text-gray-500 text-sm">© {new Date().getFullYear()} Integral. All rights reserved.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-6 md:gap-8">
              {[
                { label: "Features", id: "features" },
                { label: "Pricing", id: "pricing" },
                { label: "About", id: "about" },
              ].map(link => (
                <button key={link.id} onClick={() => scrollToSection(link.id)} className="text-gray-400 hover:text-amber-400 transition-colors" aria-label={`Scroll to ${link.label} section`}>
                  {link.label}
                </button>
              ))}
               <a href="mailto:integral.ind.in@gmail.com" className="text-gray-400 hover:text-amber-400 transition-colors">Contact</a>
            </div>
          </div>
          <div className="mt-8 text-center text-gray-500 text-sm">
            <p>For queries contact: <a href="mailto:integral.ind.in@gmail.com" className="hover:text-amber-400 transition-colors">integral.ind.in@gmail.com</a></p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
