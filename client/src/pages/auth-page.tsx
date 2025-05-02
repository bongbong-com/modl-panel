import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, KeyRound, Fingerprint } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

// Define the initial login form schema
const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  verificationMethod: z.enum(["email", "2fa", "passkey"]).default("email")
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
  const [verificationMethod, setVerificationMethod] = useState<"email" | "2fa" | "passkey">("email");
  const [isAwaitingVerification, setIsAwaitingVerification] = useState(false);
  
  // Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      verificationMethod: "email"
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

  const { user, loginMutation, error, requestEmailVerification, request2FAVerification, requestPasskeyAuthentication } = useAuth();

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
    setVerificationMethod(values.verificationMethod);
    setIsAwaitingVerification(true);
    
    // Process based on verification method
    if (values.verificationMethod === "email") {
      // Request email verification
      const code = await requestEmailVerification(values.email);
      // Clear previous code
      emailVerificationForm.setValue("code", "");
    } else if (values.verificationMethod === "2fa") {
      // Request 2FA verification
      const code = await request2FAVerification(values.email);
      // Clear previous code
      twoFaForm.setValue("code", "");
    } else if (values.verificationMethod === "passkey") {
      // Trigger passkey authentication flow
      const success = await requestPasskeyAuthentication(values.email);
      if (success) {
        // For demo, simulate successful passkey auth after short delay
        setTimeout(() => {
          loginMutation.mutate({
            username: values.email,
            verificationMethod: 'passkey'
          });
        }, 1500);
      }
    }
  };

  // Handle email verification submission
  const onEmailVerifySubmit = (values: EmailVerificationValues) => {
    // Accept any 6-digit code as valid
    loginMutation.mutate({
      username: values.email,
      verificationCode: values.code,
      verificationMethod: 'email'
    });
  };

  // Handle 2FA verification submission
  const onTwoFaSubmit = (values: TwoFaValues) => {
    // Accept any 6-digit code as valid
    loginMutation.mutate({
      username: values.email,
      verificationCode: values.code,
      verificationMethod: '2fa'
    });
  };

  // Reset verification state
  const handleBackToLogin = () => {
    setVerificationMethod("email");
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
            <FormItem className="flex flex-col items-center justify-center">
              <FormControl>
                <div className="flex justify-center space-x-2">
                  <Input
                    type="text"
                    className="w-full text-center"
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    value={field.value}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      if (val.length <= 6) {
                        field.onChange(val);
                      }
                    }}
                  />
                </div>
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
            <FormItem className="flex flex-col items-center justify-center">
              <FormControl>
                <div className="flex justify-center space-x-2">
                  <Input
                    type="text"
                    className="w-full text-center"
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    value={field.value}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      if (val.length <= 6) {
                        field.onChange(val);
                      }
                    }}
                  />
                </div>
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
          name="verificationMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Authentication Method</FormLabel>
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
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          className="w-full mt-6"
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? "Verifying..." : "Continue"}
        </Button>
      </form>
    </Form>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full p-4 md:p-10">
        {/* Auth form section */}
        <div className="flex flex-col justify-center">
          <div className="flex flex-col space-y-2 mb-8 text-center">
            <h1 className="text-3xl font-bold">cobl.gg staff panel</h1>
            <p className="text-muted-foreground">
              Authorized access only
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Login</CardTitle>
              <CardDescription>Enter your email and choose a verification method</CardDescription>
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
    </div>
  );
};

export default AuthPage;