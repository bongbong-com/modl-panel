import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "./use-toast";

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
  login: (email: string, authMethod: string, code?: string) => Promise<boolean>;
  logout: () => void;
  requestEmailVerification: (email: string) => Promise<string>;
  request2FAVerification: (email: string) => Promise<string>;
  requestPasskeyAuthentication: (email: string) => Promise<boolean>;
  updateUserDetails: (details: Partial<Pick<User, 'email' | 'username'>>) => Promise<boolean>; // Added updateUser
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
    const checkAuth = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Error checking auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Request email verification code
  const requestEmailVerification = async (email: string): Promise<string> => {
    // In demo mode, always return a valid code
    toast({
      title: "Verification email sent",
      description: "Please check your email for the code",
    });
    return "123456";
  };

  // Request 2FA verification
  const request2FAVerification = async (email: string): Promise<string> => {
    // In demo mode, always return a valid code
    toast({
      title: "2FA verification required",
      description: "Please enter the code from your authenticator app",
    });
    return "123456";
  };

  // Request passkey authentication
  const requestPasskeyAuthentication = async (email: string): Promise<boolean> => {
    // In demo mode, always succeed with passkey
    toast({
      title: "Passkey authentication",
      description: "Please confirm with your device to continue",
    });
    return true;
  };

  // Login function
  const login = async (email: string, authMethod: string, code?: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      // Simulate API call with 1 second delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // For demo purposes, any code "123456" is valid, and passkey is always valid
      if (authMethod === 'passkey' || (code && code === "123456")) {
        const newUser: User = {
          _id: "demo-user-id",
          email: email,
          username: email.split('@')[0],
          profilePicture: `https://ui-avatars.com/api/?name=${encodeURIComponent(email.split('@')[0])}`,
          admin: true
        };

        // Store user in localStorage
        localStorage.setItem('user', JSON.stringify(newUser));
        setUser(newUser);
        setIsLoading(false);

        // Show success message
        toast({
          title: "Login successful",
          description: `Welcome back, ${newUser.username}!`,
        });

        return true;
      } else {
        setIsLoading(false);

        // Show error message for invalid verification
        toast({
          title: "Verification failed",
          description: "Invalid verification code. Please try again.",
          variant: "destructive",
        });

        return false;
      }
    } catch (error) {
      setIsLoading(false);

      // Show error toast
      toast({
        title: "Login failed",
        description: "An error occurred during login. Please try again.",
        variant: "destructive",
      });

      return false;
    }
  };

  // Logout function
  const logout = () => {
    // Remove user from localStorage and state
    localStorage.removeItem('user');
    setUser(null);

    // Redirect to login page
    navigate('/auth');

    // Show success message
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
  };

  // Update user details function
  const updateUserDetails = async (details: Partial<Pick<User, 'email' | 'username'>>): Promise<boolean> => {
    if (!user) return false;
    setIsLoading(true);

    try {
      // Simulate API call with 1 second delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      const updatedUser = { ...user, ...details };

      // If username changes, update profilePicture assuming it's derived from username
      if (details.username && updatedUser.profilePicture?.includes(encodeURIComponent(user.username))) {
        updatedUser.profilePicture = `https://ui-avatars.com/api/?name=${encodeURIComponent(details.username)}`;
      }
      
      // Update user in localStorage
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setIsLoading(false);

      toast({
        title: "Profile updated",
        description: "Your account details have been successfully updated.",
      });
      return true;
    } catch (error) {
      setIsLoading(false);
      toast({
        title: "Update failed",
        description: "An error occurred while updating your profile. Please try again.",
        variant: "destructive",
      });
      return false;
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
        requestPasskeyAuthentication,
        updateUserDetails, // Added updateUser
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