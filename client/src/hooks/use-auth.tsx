import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "./use-toast";

// Define the User type
interface User {
  id: number;
  email: string;
  username: string;
}

// Define the AuthContext type
type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, authMethod: string, code?: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
};

// Create the Auth Context with default values
export const AuthContext = createContext<AuthContextType | null>(null);

// AuthProvider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      // Simulate checking localStorage or session cookies for existing auth
      const storedUser = localStorage.getItem('user');
      
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (error) {
          // Invalid stored user data
          localStorage.removeItem('user');
        }
      }
      
      setIsLoading(false);
    };

    checkAuth();
  }, []);

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