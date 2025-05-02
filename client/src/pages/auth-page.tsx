import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Fingerprint, KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

// Define the login form schema
const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  methodType: z.enum(["2fa", "email", "passkey"]),
  code: z.string().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// No registration in this app

const AuthPage = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loginStep, setLoginStep] = useState<'email' | 'verification'>('email');
  const [verificationMethod, setVerificationMethod] = useState<'2fa' | 'email' | 'passkey'>('email');

  // Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      methodType: "email",
    },
  });

  const { login, user, requestEmailVerification, request2FAVerification, requestPasskeyAuthentication } = useAuth();

  // Redirect to home page if already authenticated
  useEffect(() => {
    if (user) {
      setLocation('/');
    }
  }, [user, setLocation]);

  // Handle login form submission
  const onLoginSubmit = async (values: LoginFormValues) => {
    if (loginStep === 'email') {
      // First step - show verification methods
      setVerificationMethod(values.methodType);
      
      // Request verification based on selected method
      if (values.methodType === 'email') {
        await requestEmailVerification(values.email);
      } else if (values.methodType === '2fa') {
        await request2FAVerification(values.email);
      } else if (values.methodType === 'passkey') {
        await requestPasskeyAuthentication(values.email);
      }
      
      setLoginStep('verification');
      return;
    }

    // Second step - verify code or passkey
    try {
      const success = await login(
        values.email, 
        verificationMethod, 
        verificationMethod !== 'passkey' ? values.code : undefined
      );

      if (success) {
        // Redirect is handled by the auth hook on success
      }
    } catch (error) {
      toast({
        title: "Authentication failed",
        description: "An error occurred during authentication",
        variant: "destructive"
      });
    }
  };

  // No registration in this app

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
            <br></br>
            <CardContent>
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                  {loginStep === 'email' ? (
                    <>
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
                                  placeholder="name@example.com"
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
                        name="methodType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Verification Method</FormLabel>
                            <div className="flex flex-wrap gap-2 mt-1">
                              <Badge 
                                variant={field.value === "email" ? "default" : "outline"}
                                className="cursor-pointer py-1 px-3 hover:bg-primary/90"
                                onClick={() => field.onChange("email")}
                              >
                                <Mail className="h-3.5 w-3.5 mr-1.5" />
                                Email Code
                              </Badge>
                              <Badge 
                                variant={field.value === "2fa" ? "default" : "outline"}
                                className="cursor-pointer py-1 px-3 hover:bg-primary/90"
                                onClick={() => field.onChange("2fa")}
                              >
                                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                                2FA Code
                              </Badge>
                              <Badge 
                                variant={field.value === "passkey" ? "default" : "outline"}
                                className="cursor-pointer py-1 px-3 hover:bg-primary/90"
                                onClick={() => field.onChange("passkey")}
                              >
                                <Fingerprint className="h-3.5 w-3.5 mr-1.5" />
                                Passkey
                              </Badge>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" className="w-full mt-6">
                        Continue
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="mb-4 flex items-center gap-2">
                        <Badge>{loginForm.getValues().email}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => setLoginStep('email')}
                          className="h-7 px-2 text-xs"
                        >
                          Change
                        </Button>
                      </div>

                      {verificationMethod === 'passkey' ? (
                        <div className="py-6 flex flex-col items-center justify-center space-y-4">
                          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                            <Fingerprint className="h-8 w-8 text-primary" />
                          </div>
                          <p className="text-center text-sm text-muted-foreground max-w-[250px]">
                            Use your FIDO2 security key or built-in authenticator (Windows Hello, Touch ID, etc.)
                          </p>
                          <div className="mt-2 bg-primary/5 rounded-md p-4 w-full flex flex-col items-center">
                            <p className="text-xs text-center text-muted-foreground mb-3">Your browser will prompt you to use your passkey</p>
                            <Button 
                              type="button" 
                              onClick={() => {
                                // Simulate browser's WebAuthn API calling
                                toast({
                                  title: "Passkey prompt",
                                  description: "Your browser would prompt for biometric verification here",
                                });
                                // Wait a moment then submit the form
                                setTimeout(() => {
                                  loginForm.handleSubmit(onLoginSubmit)();
                                }, 1500);
                              }}
                              className="w-full"
                            >
                              Verify with Passkey
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <FormField
                            control={loginForm.control}
                            name="code"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  {verificationMethod === '2fa' ? '2FA Code' : 'Verification Code'}
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      {...field}
                                      placeholder="Enter your 6-digit code"
                                      className="pl-10"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      maxLength={6}
                                    />
                                  </div>
                                </FormControl>
                                <FormDescription>
                                  Enter the {verificationMethod === '2fa' ? '2FA code from your authenticator app' : 'verification code sent to your email'}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <Button type="submit" className="w-full mt-6">
                            Verify & Login
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex justify-center border-t pt-4">
              <p className="text-xs text-muted-foreground">
                Administrator contact: <a href="mailto:admin@cobl.gg" className="text-primary hover:underline">admin@cobl.gg</a>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;