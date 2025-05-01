import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, User, Lock, Mail, KeyRound, Fingerprint } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

// Define the initial login form schema
const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  verificationMethod: z.enum(["none", "email", "2fa", "passkey"])
});

// Define schema for email verification
const emailVerificationSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, { message: "Verification code must be 6 digits" })
});

// Define schema for 2FA verification
const twoFaSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, { message: "2FA code must be 6 digits" })
});

type LoginFormValues = z.infer<typeof loginSchema>;
type EmailVerificationValues = z.infer<typeof emailVerificationSchema>;
type TwoFaValues = z.infer<typeof twoFaSchema>;

const AuthPage = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<"none" | "email" | "2fa" | "passkey">("none");
  const [isAwaitingVerification, setIsAwaitingVerification] = useState(false);
  
  // Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      verificationMethod: "none"
    },
  });

  // Email verification form
  const emailVerificationForm = useForm<EmailVerificationValues>({
    resolver: zodResolver(emailVerificationSchema),
    defaultValues: {
      email: "",
      code: ""
    }
  });

  // 2FA verification form
  const twoFaForm = useForm<TwoFaValues>({
    resolver: zodResolver(twoFaSchema),
    defaultValues: {
      email: "",
      code: ""
    }
  });

  const { user, loginMutation, error } = useAuth();

  // Redirect to home page if already authenticated
  useEffect(() => {
    if (user) {
      setLocation('/');
    }
  }, [user, setLocation]);

  // Update verification form emails when main form email changes
  useEffect(() => {
    const email = loginForm.watch("email");
    emailVerificationForm.setValue("email", email);
    twoFaForm.setValue("email", email);
  }, [loginForm.watch("email")]);

  // Handle login form submission
  const onLoginSubmit = async (values: LoginFormValues) => {
    // If verification method is chosen, set the state for 2nd step
    if (values.verificationMethod !== "none") {
      setVerificationMethod(values.verificationMethod);
      setIsAwaitingVerification(true);
      
      // Show notification based on verification method
      if (values.verificationMethod === "email") {
        toast({
          title: "Verification email sent",
          description: "Please check your email for a verification code",
        });
      } else if (values.verificationMethod === "2fa") {
        toast({
          title: "2FA Required",
          description: "Please enter your 2FA code from your authenticator app",
        });
      } else if (values.verificationMethod === "passkey") {
        // Trigger passkey authentication flow
        toast({
          title: "Passkey Authentication",
          description: "Please confirm with your device to continue",
        });
        // Temporary simulation of passkey auth
        setTimeout(() => {
          loginMutation.mutate({
            username: values.email.split('@')[0],
            password: values.password,
          });
        }, 1500);
      }
    } else {
      // Standard username/password login
      loginMutation.mutate({
        username: values.email.split('@')[0],
        password: values.password,
      });
    }
  };

  // Handle email verification submission
  const onEmailVerifySubmit = (values: EmailVerificationValues) => {
    // For now, simulate a successful verification
    loginMutation.mutate({
      username: values.email.split('@')[0],
      password: "verified-via-email-code",
    });
  };

  // Handle 2FA verification submission
  const onTwoFaSubmit = (values: TwoFaValues) => {
    // For now, simulate a successful verification
    loginMutation.mutate({
      username: values.email.split('@')[0],
      password: "verified-via-2fa",
    });
  };

  // Reset verification state
  const handleBackToLogin = () => {
    setVerificationMethod("none");
    setIsAwaitingVerification(false);
  };

  // Render email verification step
  const renderEmailVerification = () => (
    <Form {...emailVerificationForm}>
      <form onSubmit={emailVerificationForm.handleSubmit(onEmailVerifySubmit)} className="space-y-4">
        <div className="text-center mb-4">
          <h3 className="text-lg font-medium">Email Verification</h3>
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code sent to {emailVerificationForm.getValues().email}
          </p>
        </div>
        
        <FormField
          control={emailVerificationForm.control}
          name="code"
          render={({ field }) => (
            <FormItem className="mx-auto">
              <FormControl>
                <InputOTP maxLength={6} {...field}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col space-y-2 mt-6">
          <Button type="submit" disabled={emailVerificationForm.formState.isSubmitting}>
            Verify Email
          </Button>
          <Button type="button" variant="ghost" onClick={handleBackToLogin}>
            Back to Login
          </Button>
        </div>
      </form>
    </Form>
  );

  // Render 2FA verification step
  const renderTwoFaVerification = () => (
    <Form {...twoFaForm}>
      <form onSubmit={twoFaForm.handleSubmit(onTwoFaSubmit)} className="space-y-4">
        <div className="text-center mb-4">
          <h3 className="text-lg font-medium">Two-Factor Authentication</h3>
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>
        
        <FormField
          control={twoFaForm.control}
          name="code"
          render={({ field }) => (
            <FormItem className="mx-auto">
              <FormControl>
                <InputOTP maxLength={6} {...field}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col space-y-2 mt-6">
          <Button type="submit" disabled={twoFaForm.formState.isSubmitting}>
            Verify Code
          </Button>
          <Button type="button" variant="ghost" onClick={handleBackToLogin}>
            Back to Login
          </Button>
        </div>
      </form>
    </Form>
  );

  // Render passkey verification step
  const renderPasskeyAuthentication = () => (
    <div className="space-y-4 text-center">
      <div className="py-8">
        <Fingerprint className="mx-auto h-16 w-16 text-primary animate-pulse" />
        <h3 className="text-lg font-medium mt-4">Passkey Authentication</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Verify your identity using your passkey
        </p>
      </div>

      <div className="flex flex-col space-y-2 mt-6">
        <Button type="button" onClick={handleBackToLogin} variant="ghost">
          Cancel
        </Button>
      </div>
    </div>
  );

  // Render main login form
  const renderLoginForm = () => (
    <Form {...loginForm}>
      <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
        <FormField
          control={loginForm.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    {...field}
                    type="email"
                    placeholder="Enter your email"
                    className="pl-10"
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={loginForm.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    {...field}
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className="pl-10 pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={loginForm.control}
          name="verificationMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Verification Method (Optional)</FormLabel>
              <FormControl>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={field.value === "email" ? "default" : "outline"}
                    className="flex flex-col h-auto py-2 px-3"
                    onClick={() => field.onChange("email")}
                  >
                    <Mail className="h-4 w-4 mb-1" />
                    <span className="text-xs">Email</span>
                  </Button>
                  <Button
                    type="button"
                    variant={field.value === "2fa" ? "default" : "outline"}
                    className="flex flex-col h-auto py-2 px-3"
                    onClick={() => field.onChange("2fa")}
                  >
                    <KeyRound className="h-4 w-4 mb-1" />
                    <span className="text-xs">2FA</span>
                  </Button>
                  <Button
                    type="button"
                    variant={field.value === "passkey" ? "default" : "outline"}
                    className="flex flex-col h-auto py-2 px-3"
                    onClick={() => field.onChange("passkey")}
                  >
                    <Fingerprint className="h-4 w-4 mb-1" />
                    <span className="text-xs">Passkey</span>
                  </Button>
                </div>
              </FormControl>
              <FormDescription className="text-xs">
                Choose an additional verification method (recommended)
              </FormDescription>
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          className="w-full mt-6"
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? "Logging in..." : "Login"}
        </Button>
      </form>
    </Form>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Left side - Auth form */}
      <div className="w-full md:w-1/2 p-4 md:p-10 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="flex flex-col space-y-2 mb-8 text-center">
            <h1 className="text-3xl font-bold">Staff Panel</h1>
            <p className="text-muted-foreground">
              Welcome back to the cobl.gg moderation system
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Secure Login</CardTitle>
              <CardDescription>
                Only authorized staff members can access this panel
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isAwaitingVerification ? (
                verificationMethod === "email" ? renderEmailVerification() :
                verificationMethod === "2fa" ? renderTwoFaVerification() :
                verificationMethod === "passkey" ? renderPasskeyAuthentication() :
                renderLoginForm()
              ) : (
                renderLoginForm()
              )}
            </CardContent>
            <CardFooter className="flex justify-center border-t pt-4">
              <p className="text-xs text-muted-foreground">
                Need help? Contact <a href="mailto:admin@cobl.gg" className="text-primary hover:underline">admin@cobl.gg</a>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Right side - Hero section */}
      <div className="hidden md:flex md:w-1/2 bg-primary/10 p-10 items-center justify-center">
        <div className="max-w-lg">
          <h2 className="text-3xl font-bold mb-4">Moderation Dashboard</h2>
          <ul className="space-y-4">
            <li className="flex items-start">
              <span className="bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center mr-2 shrink-0">1</span>
              <div>
                <h3 className="font-medium">Manage Player Reports</h3>
                <p className="text-sm text-muted-foreground">Handle player reports and moderate game chat efficiently</p>
              </div>
            </li>
            <li className="flex items-start">
              <span className="bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center mr-2 shrink-0">2</span>
              <div>
                <h3 className="font-medium">Track Punishments</h3>
                <p className="text-sm text-muted-foreground">View and manage player punishments with complete audit logs</p>
              </div>
            </li>
            <li className="flex items-start">
              <span className="bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center mr-2 shrink-0">3</span>
              <div>
                <h3 className="font-medium">Review Appeals</h3>
                <p className="text-sm text-muted-foreground">Process ban appeals and communicate with players</p>
              </div>
            </li>
            <li className="flex items-start">
              <span className="bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center mr-2 shrink-0">4</span>
              <div>
                <h3 className="font-medium">Real-time Monitoring</h3>
                <p className="text-sm text-muted-foreground">Get alerts for suspicious player activity and server issues</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;