import React, { useState, useEffect } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { NAV_LINKS_DATA } from "../constants";
import { NavLink } from "../types";
import { Button } from "../components"; // Corrected import path
import { MenuIcon } from "./icons/MenuIcon";
import { XIcon } from "./icons/XIcon"; // Ensured correct relative path

const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    setIsMobileMenuOpen(false); // Close mobile menu on link click
    const element = document.getElementById(sectionId.startsWith("#") ? sectionId.substring(1) : sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    } else if (!sectionId.startsWith("#")) {
      // If it's not a hash link, navigate using router
      navigate(sectionId);
    }
  };

  const navLinksToUse = NAV_LINKS_DATA.filter(link => link.href.startsWith("#")); // Only use hash links for scrolling

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? "bg-black bg-opacity-80 backdrop-blur-md py-3 shadow-lg" : "bg-transparent py-5"
        }`}
        aria-label="Main navigation"
      >
        <div className="container mx-auto px-4 flex justify-between items-center">
          <RouterLink to="/" className="flex items-center" onClick={() => setIsMobileMenuOpen(false)}>
            {/* Replaced Next/Image with styled text logo from previous version */}
            <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-amber-600">
              Integral
            </span>
          </RouterLink>

          <nav className="hidden md:flex items-center space-x-6 lg:space-x-8" aria-label="Desktop navigation links">
            {navLinksToUse.map((link: NavLink) => (
              <button
                key={link.label}
                onClick={() => scrollToSection(link.href)}
                className="text-gray-300 hover:text-amber-400 px-3 py-2 rounded-md text-base font-medium transition-colors duration-150"
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="hidden md:flex items-center space-x-4">
            <Button
              variant="ghost"
              className="text-gray-300 hover:text-amber-400 hover:bg-gray-800/50"
              onClick={() => navigate("/signin")}
            >
              Sign In
            </Button>
            <Button
              className="bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white"
              onClick={() => navigate("/signup")}
            >
              Sign Up
            </Button>
          </div>

          <button
            className="md:hidden text-gray-300 hover:text-amber-400"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {isMobileMenuOpen ? <XIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black bg-opacity-95 pt-20 px-4 md:hidden" // pt-20 to account for header height
          >
            <nav className="flex flex-col space-y-6 items-center text-lg pt-5" aria-label="Mobile navigation links">
              {navLinksToUse.map((link: NavLink) => (
                <button
                  key={`mobile-${link.label}`}
                  className="text-gray-300 hover:text-amber-400 transition-colors w-full text-center py-2"
                  onClick={() => scrollToSection(link.href)}
                >
                  {link.label}
                </button>
              ))}
              <div className="pt-6 flex flex-col w-full max-w-xs mx-auto space-y-4">
                <Button
                  variant="outline"
                  className="w-full border-gray-600 text-gray-300 hover:bg-gray-800 hover:border-amber-500"
                  onClick={() => {
                    navigate("/signin");
                    setIsMobileMenuOpen(false);
                  }}
                >
                  Sign In
                </Button>
                <Button
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white"
                  onClick={() => {
                    navigate("/signup");
                    setIsMobileMenuOpen(false);
                  }}
                >
                  Sign Up
                </Button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;