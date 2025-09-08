import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../components';
import { supabase } from '../supabaseClient';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        throw resetError;
      }

      setSuccessMessage(
        "Password reset email sent! Please check your inbox and follow the instructions to reset your password."
      );
      setEmail(''); // Clear the email field
    } catch (err: any) {
      setError(err.error_description || err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-gray-800 p-8 md:p-12 rounded-xl shadow-2xl w-full max-w-md text-center border border-gray-700"
      >
        <div className="mb-6">
          <div className="w-16 h-16 bg-gradient-to-r from-primary to-primary-dark rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-2 text-white">Forgot Password?</h1>
          <p className="text-gray-300">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 text-red-400 border border-red-500/50 rounded-md text-sm">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-500/20 text-green-300 border border-green-500/50 rounded-md text-sm">
            {successMessage}
          </div>
        )}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 text-left mb-1">
              Email Address
            </label>
            <input 
              type="email" 
              name="email" 
              id="email" 
              className="w-full px-4 py-2.5 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-primary focus:border-primary placeholder-gray-500" 
              placeholder="Enter your email address" 
              required 
              aria-required="true"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading || !!successMessage}
            />
          </div>
          
          <Button 
            type="submit" 
            size="lg" 
            className="w-full bg-gradient-to-r from-primary to-primary-dark hover:from-primary-light hover:to-primary text-white shadow-lg"
            disabled={loading || !!successMessage}
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending Email...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Send Reset Email
              </>
            )}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-gray-400 mb-4">
            Remember your password?{' '}
            <Link to="/signin" className="font-medium text-primary-light hover:text-primary transition-colors">
              Back to Sign In
            </Link>
          </p>
          
          <p className="text-gray-400">
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium text-primary-light hover:text-primary transition-colors">
              Sign Up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;