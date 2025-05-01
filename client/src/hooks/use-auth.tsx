import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "./use-toast";
import { apiRequest, queryClient, getQueryFn } from "../lib/queryClient";

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
  verificationCode?: string;
  verificationMethod?: 'email' | '2fa' | 'passkey';
};

// Define the AuthContext type
type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  requestEmailVerification: (email: string) => Promise<boolean>;
  request2FAVerification: (email: string) => Promise<boolean>;
  requestPasskeyAuthentication: (email: string) => Promise<boolean>;
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
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  // Request email verification code
  const requestEmailVerification = async (email: string): Promise<boolean> => {
    try {
      // In a real implementation, this would call an API to send an email
      // For now, we'll just simulate success
      console.log(`Email verification requested for: ${email}`);
      return true;
    } catch (error) {
      console.error("Error requesting email verification:", error);
      return false;
    }
  };

  // Request 2FA verification
  const request2FAVerification = async (email: string): Promise<boolean> => {
    try {
      // In a real implementation, this would verify the user has 2FA set up
      console.log(`2FA verification requested for: ${email}`);
      return true;
    } catch (error) {
      console.error("Error requesting 2FA verification:", error);
      return false;
    }
  };

  // Request passkey authentication
  const requestPasskeyAuthentication = async (email: string): Promise<boolean> => {
    try {
      // In a real implementation, this would start the WebAuthn flow
      console.log(`Passkey authentication requested for: ${email}`);
      return true;
    } catch (error) {
      console.error("Error requesting passkey authentication:", error);
      return false;
    }
  };

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      // For now we're just handling username/password login through the existing API
      const res = await apiRequest("POST", "/api/login", {
        username: credentials.username,
        password: credentials.password
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Login failed");
      }
      
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(['/api/user'], user);
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.username}!`,
      });
      navigate('/');
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/logout");
      if (!res.ok) {
        throw new Error("Logout failed");
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(['/api/user'], null);
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
      navigate('/auth');
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
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