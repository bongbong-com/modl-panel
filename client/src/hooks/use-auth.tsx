import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "./use-toast";
import { apiRequest, queryClient } from "../lib/queryClient";

// Define the User type to match our MongoDB schema
interface User {
  _id: string;
  email: string;
  username: string;
  profilePicture?: string;
  admin: boolean;
}

// Login data structure
type LoginData = {
  username: string;
  password: string;
};

// Register data structure
type RegisterData = {
  username: string;
  email: string;
  password: string;
};

// Define the AuthContext type
type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterData>;
};

// Create the Auth Context with default values
export const AuthContext = createContext<AuthContextType | null>(null);

// AuthProvider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Query to check current user
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null, Error>({
    queryKey: ['/api/user'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/user');
        if (res.status === 401) {
          return null; // Not authenticated
        }
        if (!res.ok) {
          throw new Error('Failed to fetch user');
        }
        return await res.json();
      } catch (err) {
        console.error('Error fetching user:', err);
        return null;
      }
    }
  });

  // Login function
  const login = async (email: string, authMethod: string, code?: string): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      // Simulate API call with 1 second delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For demo purposes, any code "123456" is valid, and passkey is always valid
      if (authMethod === 'passkey' || (code && code === "123456")) {
        const user = {
          id: 1,
          email,
          username: email.split('@')[0],
        };
        
        // Store user in localStorage
        localStorage.setItem('user', JSON.stringify(user));
        setUser(user);
        setIsLoading(false);
        
        // Show success message
        toast({
          title: "Login successful",
          description: `Welcome back, ${user.username}!`,
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

  // Register function
  const register = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      // Simulate API call with 1 second delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For demo purposes, registration always succeeds
      setIsLoading(false);
      
      // Show success message
      toast({
        title: "Registration successful",
        description: "Your account has been created. You can now login.",
      });
      
      return true;
    } catch (error) {
      setIsLoading(false);
      
      // Show error toast
      toast({
        title: "Registration failed",
        description: "An error occurred during registration. Please try again.",
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
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