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

// Verification response type
interface VerificationResponse {
  message: string;
  code?: string; // For demo purposes only
  challenge?: string;
}

// Login data structure
type LoginData = {
  username: string;
  password?: string;
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
  requestEmailVerification: (email: string) => Promise<string | null>;
  request2FAVerification: (email: string) => Promise<string | null>;
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
  const requestEmailVerification = async (email: string): Promise<string | null> => {
    try {
      const res = await apiRequest("POST", "/api/request-email-verification", { email });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to request email verification");
      }
      
      const data = await res.json() as VerificationResponse;
      toast({
        title: "Verification email sent",
        description: "Please check your email for the code",
      });
      
      // In a real app, we would never return this - the code would be sent via email
      // This is only for demonstration purposes
      return data.code || null;
    } catch (error) {
      console.error("Error requesting email verification:", error);
      toast({
        title: "Verification failed",
        description: error instanceof Error ? error.message : "Failed to send verification code",
        variant: "destructive",
      });
      return null;
    }
  };

  // Request 2FA verification
  const request2FAVerification = async (email: string): Promise<string | null> => {
    try {
      const res = await apiRequest("POST", "/api/request-2fa-verification", { email });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to request 2FA verification");
      }
      
      const data = await res.json() as VerificationResponse;
      toast({
        title: "2FA verification required",
        description: "Please enter the code from your authenticator app",
      });
      
      // In a real app, the code would be provided by the user's authenticator app
      // This is only for demonstration purposes
      return data.code || null;
    } catch (error) {
      console.error("Error requesting 2FA verification:", error);
      toast({
        title: "2FA verification failed",
        description: error instanceof Error ? error.message : "Failed to initialize 2FA verification",
        variant: "destructive",
      });
      return null;
    }
  };

  // Request passkey authentication
  const requestPasskeyAuthentication = async (email: string): Promise<boolean> => {
    try {
      const res = await apiRequest("POST", "/api/request-passkey-auth", { email });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to request passkey authentication");
      }
      
      const data = await res.json() as VerificationResponse;
      toast({
        title: "Passkey authentication",
        description: "Please confirm with your device to continue",
      });
      
      // For now, just return success - in a real implementation, 
      // we would initiate the WebAuthn flow here
      return true;
    } catch (error) {
      console.error("Error requesting passkey authentication:", error);
      toast({
        title: "Passkey authentication failed",
        description: error instanceof Error ? error.message : "Failed to initialize passkey authentication",
        variant: "destructive",
      });
      return false;
    }
  };

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      
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