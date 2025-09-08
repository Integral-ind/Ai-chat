
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../components'; // Adjusted import path
import { supabase } from '../supabaseClient'; // Import Supabase client

const SignUpPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName, // You can add custom data here
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (data.user && data.user.identities && data.user.identities.length === 0) {
        // This case might indicate an "Email rate limit exceeded" or similar issue where user object is returned but identities array is empty.
        setError("Sign up failed. The email address may already be in use or there was an issue with the service. Please try again later or use a different email.");
      } else if (data.session) {
        // User is automatically signed in
         setSuccessMessage("Account created successfully! You are now signed in.");
        // Potentially redirect or call a global login handler from App.tsx
        // For now, App.tsx's onAuthStateChange will handle this.
      } else if (data.user) {
        // User exists but session is null, means confirmation email sent
        setSuccessMessage("Account created! Please check your email for a confirmation link to complete your registration.");
      } else {
        // Fallback for unexpected response
        setError("Sign up failed. Please try again.");
      }

    } catch (err: any) {
      setError(err.error_description || err.message || "An unexpected error occurred during sign up.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    setError(null);

    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (googleError) {
        throw googleError;
      }
      
      // The redirect will handle the rest of the authentication flow
    } catch (err: any) {
      setError(err.error_description || err.message || "Failed to sign up with Google.");
      setGoogleLoading(false);
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
        <h1 className="text-4xl font-bold mb-4 text-primary-light">Create Account</h1>
        <p className="text-gray-300 mb-8">Join Integral and boost your productivity.</p>
        
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
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-300 text-left mb-1">Full Name</label>
            <input 
              type="text" 
              name="fullName" 
              id="fullName" 
              className="w-full px-4 py-2.5 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-primary-light focus:border-primary-light placeholder-gray-500" 
              placeholder="Your Name" 
              required 
              aria-required="true"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 text-left mb-1">Email Address</label>
            <input 
              type="email" 
              name="email" 
              id="email" 
              className="w-full px-4 py-2.5 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-primary-light focus:border-primary-light placeholder-gray-500" 
              placeholder="you@example.com" 
              required 
              aria-required="true"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 text-left mb-1">Password</label>
            <input 
              type="password" 
              name="password" 
              id="password" 
              className="w-full px-4 py-2.5 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-primary-light focus:border-primary-light placeholder-gray-500" 
              placeholder="Create a strong password (min. 6 characters)" 
              required 
              aria-required="true"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
           <Button 
            type="submit" 
            size="lg" 
            className="w-full bg-gradient-to-r from-primary to-primary-dark hover:from-primary-light hover:to-primary text-white shadow-lg"
            disabled={loading || googleLoading || !!successMessage} // Disable if successfully signed up
          >
            {loading ? (
               <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : 'Sign Up'}
          </Button>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center">
          <div className="flex-1 border-t border-gray-600"></div>
          <span className="px-4 text-sm text-gray-400">or</span>
          <div className="flex-1 border-t border-gray-600"></div>
        </div>

        {/* Google Sign Up Button */}
        <Button
          onClick={handleGoogleSignUp}
          disabled={loading || googleLoading || !!successMessage}
          className="w-full bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 shadow-sm"
          size="lg"
        >
          {googleLoading ? (
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          Continue with Google
        </Button>

        <p className="mt-8 text-gray-400">
          Already have an account?{' '}
          <Link to="/signin" className="font-medium text-primary-light hover:text-primary">
            Sign In
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default SignUpPage;
