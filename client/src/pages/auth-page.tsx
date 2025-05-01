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

// Define the registration form schema
const registerSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const AuthPage = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

  // Registration form
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const { login, register: authRegister, user } = useAuth();

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
      toast({
        title: "Email verification sent",
        description: `A verification code has been sent to ${values.email}`,
      });
      
      setVerificationMethod(values.methodType);
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

  // Handle registration form submission
  const onRegisterSubmit = async (values: RegisterFormValues) => {
    try {
      const success = await authRegister(values.email, values.password);
      
      if (success) {
        // Switch to login tab
        setActiveTab("login");
      }
    } catch (error) {
      toast({
        title: "Registration failed",
        description: "An error occurred during registration",
        variant: "destructive"
      });
    }
  };

  // Reset the login flow if the user changes tabs
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === "login") {
      setLoginStep('email');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-6 p-4 md:p-10">
        {/* Auth form section */}
        <div className="flex flex-col justify-center">
          <div className="flex flex-col space-y-2 mb-8">
            <h1 className="text-3xl font-bold">Game Moderation Panel</h1>
            <p className="text-muted-foreground">
              Access the administrative tools to manage player support tickets and server issues
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle>Login to your account</CardTitle>
                  <CardDescription>
                    Enter your credentials to access the moderation panel
                  </CardDescription>
                </CardHeader>
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
                                Press the button below to authenticate using your passkey
                              </p>
                              <Button type="submit" className="mt-2">
                                Authenticate with Passkey
                              </Button>
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
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card>
                <CardHeader>
                  <CardTitle>Create an account</CardTitle>
                  <CardDescription>
                    Register to gain access to the moderation panel
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                      <FormField
                        control={registerForm.control}
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
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                  {...field}
                                  type={showPassword ? "text" : "password"}
                                  placeholder="********"
                                  className="pl-10 pr-10"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-1 top-1 h-8 w-8"
                                  onClick={() => setShowPassword(!showPassword)}
                                >
                                  {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </FormControl>
                            <FormDescription>
                              Password must be at least 8 characters
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                  {...field}
                                  type={showConfirmPassword ? "text" : "password"}
                                  placeholder="********"
                                  className="pl-10 pr-10"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-1 top-1 h-8 w-8"
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                  {showConfirmPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" className="w-full mt-6">
                        Create Account
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Hero section */}
        <div className="hidden md:flex flex-col justify-center">
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg p-10 h-full flex flex-col justify-center">
            <div className="mb-6">
              <Badge className="mb-4" variant="outline">Staff Only Access</Badge>
              <h2 className="text-3xl font-bold mb-3">Game Server Moderation Panel</h2>
              <p className="text-muted-foreground mb-6">
                Empowering administrators with powerful tools for efficient player interaction and ticket management.
              </p>
              <Separator className="my-6" />
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 rounded-full bg-primary/10">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">Multi-factor Authentication</h3>
                  <p className="text-sm text-muted-foreground">Secure your account with email verification, 2FA, or passkey authentication.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 rounded-full bg-primary/10">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">Manage Tickets Efficiently</h3>
                  <p className="text-sm text-muted-foreground">Handle player support requests, bug reports, and appeals from a central dashboard.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 rounded-full bg-primary/10">
                  <LockKeyhole className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">Admin-Only Features</h3>
                  <p className="text-sm text-muted-foreground">Access powerful moderation tools with role-based permissions.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;