import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "./use-toast";
import { startAuthentication, type AuthenticationResponseJSON } from '@simplewebauthn/browser';

// Define the User type to match our MongoDB schema
interface User {
  _id: string;
  email: string;
  username: string;
  profilePicture?: string;
  admin: boolean;
}

// Define the AuthContext type
type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, authMethod: string, code?: string, assertionResponse?: AuthenticationResponseJSON) => Promise<boolean>;
  logout: () => void;
  requestEmailVerification: (email: string) => Promise<string | undefined>;
  request2FAVerification: (email: string) => Promise<string | undefined>; // Adjusted return type
  requestPasskeyAuthentication: (email: string) => Promise<boolean>; // This will now orchestrate the full FIDO login
};

// Create the Auth Context with default values
export const AuthContext = createContext<AuthContextType | null>(null);

// AuthProvider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check for existing user session on mount
  useEffect(() => {
    const checkSession = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/auth/session');
        if (response.ok) {
          const data = await response.json();
          if (data.isAuthenticated && data.user) {
            setUser(data.user);
          } else {
            setUser(null);
          }
        } else {
          // If session check fails (e.g., 401), ensure user is null
          setUser(null);
        }
      } catch (error) {
        console.error('Error checking session:', error);
        setUser(null); // Ensure user is null on network error
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  // Request email verification code
  const requestEmailVerification = async (email: string): Promise<string | undefined> => {
    try {
      const response = await fetch('/api/auth/send-email-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast({
          title: "Error",
          description: data.message || "Failed to send verification code.",
          variant: "destructive",
        });
        return undefined;
      }
      toast({
        title: "Verification Email Sent",
        description: "Please check your email for the verification code.",
      });
      // In dev, the backend might return the code for easier testing if email sending is disabled
      return data.code; // This might be undefined in production if code is not sent back
    } catch (error) {
      console.error("Error requesting email verification:", error);
      toast({
        title: "Network Error",
        description: "Could not connect to the server to send verification code.",
        variant: "destructive",
      });
      return undefined;
    }
  };

  // Request 2FA verification
  const request2FAVerification = async (email: string): Promise<string | undefined> => {
    // This function is called when 2FA is selected.
    // The actual code submission and verification is handled by the `login` function.
    // We can show a toast here to guide the user.
    toast({
      title: "2FA Authentication",
      description: "Enter the code from your authenticator app.",
    });
    // No code is returned here as it's entered by the user directly.
    return undefined;
  };

  // Request passkey authentication (challenge + assertion)
  const requestPasskeyAuthentication = async (email: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      // 1. Get Challenge
      const challengeResponse = await fetch('/api/auth/fido-login-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const challengeData = await challengeResponse.json();

      if (!challengeResponse.ok) {
        toast({
          title: "Passkey Error",
          description: challengeData.message || "Failed to get passkey challenge.",
          variant: "destructive",
        });
        setIsLoading(false);
        return false;
      }

      // 2. Start Assertion (Browser API)
      let assertionResult: AuthenticationResponseJSON;
      try {
        assertionResult = await startAuthentication(challengeData);
      } catch (error: any) {
        console.error("Error during startAssertion:", error);
        // Handle user cancellation or other browser errors
        let errorMessage = "Passkey operation failed or was cancelled.";
        if (error.name === 'NotAllowedError') {
            errorMessage = "Passkey authentication was cancelled or not allowed.";
        }
        toast({
          title: "Passkey Cancelled",
          description: errorMessage,
          variant: "default",
        });
        setIsLoading(false);
        return false;
      }
      
      // 3. Verify Assertion with backend (by calling the login function)
      // The login function will set isLoading(false)
      return await login(email, 'passkey', undefined, assertionResult);

    } catch (error) {
      console.error("Error during passkey authentication flow:", error);
      toast({
        title: "Passkey Error",
        description: "An unexpected error occurred during passkey authentication.",
        variant: "destructive",
      });
      setIsLoading(false);
      return false;
    }
  };

  // Login function
  const login = async (email: string, authMethod: string, code?: string, assertionResponse?: AuthenticationResponseJSON): Promise<boolean> => {
    setIsLoading(true);
    try {
      let response;
      let requestBody;

      if (authMethod === 'email') {
        if (!code) {
          toast({ title: "Error", description: "Email verification code is required.", variant: "destructive" });
          setIsLoading(false);
          return false;
        }
        requestBody = JSON.stringify({ email, code });
        response = await fetch('/api/auth/verify-email-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
        });
      } else if (authMethod === 'passkey') {
        if (!assertionResponse) {
          toast({ title: "Error", description: "Passkey assertion response is required.", variant: "destructive" });
          setIsLoading(false);
          return false;
        }
        requestBody = JSON.stringify({ email, assertionResponse });
        response = await fetch('/api/auth/fido-login-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
        });
      } else if (authMethod === '2fa') {
        if (!code) {
          toast({ title: "Error", description: "2FA code is required.", variant: "destructive" });
          setIsLoading(false);
          return false;
        }
        requestBody = JSON.stringify({ email, code });
        response = await fetch('/api/auth/verify-2fa-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
        });
      } else {
        toast({ title: "Error", description: "Unsupported authentication method.", variant: "destructive" });
        setIsLoading(false);
        return false;
      }

      if (!response) { // Should only happen if authMethod was not 'email' and not handled above
        setIsLoading(false);
        return false;
      }
      
      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "Login Failed",
          description: data.message || "An error occurred during login.",
          variant: "destructive",
        });
        setIsLoading(false);
        return false;
      }

      // Backend now handles session creation.
      // After successful verification, fetch the session to get user data.
      try {
        const sessionResponse = await fetch('/api/auth/session');
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          if (sessionData.isAuthenticated && sessionData.user) {
            setUser(sessionData.user);
            toast({
              title: "Login Successful",
              description: `Welcome back, ${sessionData.user.username}!`,
            });
            setIsLoading(false);
            return true;
          } else {
            // This case should ideally not happen if login verification was successful
            // and session was established.
            toast({
              title: "Login Failed",
              description: "Session could not be established after login.",
              variant: "destructive",
            });
            setUser(null);
            setIsLoading(false);
            return false;
          }
        } else {
          toast({
            title: "Login Failed",
            description: "Failed to retrieve session information after login.",
            variant: "destructive",
          });
          setUser(null);
          setIsLoading(false);
          return false;
        }
      } catch (sessionError) {
        console.error("Error fetching session after login:", sessionError);
        toast({
          title: "Login Error",
          description: "An error occurred while fetching session information.",
          variant: "destructive",
        });
        setUser(null);
        setIsLoading(false);
        return false;
      }

    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Login Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
      return false;
    }
  };

  // Logout function
  const logout = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) {
        // Even if logout API fails, clear client-side state
        const errorData = await response.json().catch(() => ({ message: "Failed to logout on server." }));
        toast({
          title: "Logout Error",
          description: errorData.message || "Server logout failed. Client session cleared.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Logged out",
          description: "You have been successfully logged out.",
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Logout Error",
        description: "An unexpected error occurred during logout. Client session cleared.",
        variant: "destructive",
      });
    } finally {
      setUser(null);
      setIsLoading(false);
      navigate('/auth'); // Redirect to login page
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        requestEmailVerification,
        request2FAVerification,
        requestPasskeyAuthentication
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}