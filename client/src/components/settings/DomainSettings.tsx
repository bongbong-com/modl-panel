import React, { useState, useEffect } from 'react';
import { Globe, CheckCircle, AlertCircle, Copy, ExternalLink, RefreshCw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface DomainStatus {
  domain: string;
  status: 'pending' | 'active' | 'error' | 'verifying';
  cnameConfigured: boolean;
  sslStatus: 'pending' | 'active' | 'error';
  lastChecked: string;
  error?: string;
}

const DomainSettings: React.FC = () => {
  const [customDomain, setCustomDomain] = useState<string>('');
  const [currentDomain, setCurrentDomain] = useState<string>('');
  const [domainStatus, setDomainStatus] = useState<DomainStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Get current subdomain from window location
  useEffect(() => {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    if (parts.length > 2) {
      setCurrentDomain(parts[0]);
    }
  }, []);

  // Load existing domain configuration
  useEffect(() => {
    loadDomainConfig();
  }, []);

  const loadDomainConfig = async () => {
    try {
      const response = await fetch('/api/settings/domain');
      if (response.ok) {
        const data = await response.json();
        if (data.customDomain) {
          setCustomDomain(data.customDomain);
          setDomainStatus(data.status);
        }
      }
    } catch (error) {
      console.error('Error loading domain configuration:', error);
    }
  };

  const validateDomain = (domain: string): boolean => {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
    return domainRegex.test(domain) && domain.length <= 253;
  };

  const handleDomainSubmit = async () => {
    if (!customDomain.trim()) {
      toast({
        title: "Error",
        description: "Please enter a domain name",
        variant: "destructive",
      });
      return;
    }

    if (!validateDomain(customDomain)) {
      toast({
        title: "Invalid Domain",
        description: "Please enter a valid domain name (e.g., panel.yourdomain.com)",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/domain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customDomain }),
      });

      if (response.ok) {
        const data = await response.json();
        setDomainStatus(data.status);
        toast({
          title: "Domain Configuration Started",
          description: "Your custom domain has been configured. Please set up the CNAME record and click verify.",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to configure domain",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to configure domain. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyDomain = async () => {
    if (!customDomain) return;

    setIsVerifying(true);
    try {
      const response = await fetch('/api/settings/domain/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain: customDomain }),
      });

      if (response.ok) {
        const data = await response.json();
        setDomainStatus(data.status);
        
        if (data.status.status === 'active') {
          toast({
            title: "Domain Verified",
            description: "Your custom domain is now active with SSL certificate!",
          });
        } else if (data.status.status === 'error') {
          toast({
            title: "Verification Failed",
            description: data.status.error || "Failed to verify domain configuration",
            variant: "destructive",
          });
        }
      } else {
        const error = await response.json();
        toast({
          title: "Verification Error",
          description: error.message || "Failed to verify domain",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to verify domain. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRemoveDomain = async () => {
    if (!customDomain) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/domain', {
        method: 'DELETE',
      });

      if (response.ok) {
        setCustomDomain('');
        setDomainStatus(null);
        toast({
          title: "Domain Removed",
          description: "Custom domain has been removed. You can now access your panel via the default subdomain.",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to remove domain",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove domain. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied",
      description: "CNAME record copied to clipboard",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'verifying': return 'bg-blue-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Active';
      case 'pending': return 'Pending';
      case 'verifying': return 'Verifying';
      case 'error': return 'Error';
      default: return 'Unknown';
    }
  };

  // Only show to Super Admin or Admin
  if (!user || !['Super Admin', 'Admin'].includes(user.role)) {
    return (
      <div className="flex items-center justify-center h-64 border-2 border-dashed border-muted rounded-lg">
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Custom Domain Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Set up a custom domain for your moderation panel with automatic SSL/TLS certificate management.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Domain Setup
          </CardTitle>
          <CardDescription>
            Configure your custom domain to access your panel instead of using {currentDomain}.modl.gg
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="customDomain">Custom Domain</Label>
              <Input
                id="customDomain"
                type="text"
                placeholder="panel.yourdomain.com"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter your custom domain (e.g., panel.yourdomain.com)
              </p>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleDomainSubmit} 
                disabled={isLoading || !customDomain.trim()}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Configuring...
                  </>
                ) : (
                  'Configure Domain'
                )}
              </Button>
            </div>
          </div>

          {domainStatus && (
            <div className="space-y-4">
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={`${getStatusColor(domainStatus.status)} text-white`}>
                    {getStatusText(domainStatus.status)}
                  </Badge>
                  <span className="text-sm font-medium">{domainStatus.domain}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleVerifyDomain}
                    disabled={isVerifying}
                  >
                    {isVerifying ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Verify
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRemoveDomain}
                    disabled={isLoading}
                  >
                    Remove
                  </Button>
                </div>
              </div>

              {domainStatus.status === 'error' && domainStatus.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Configuration Error</AlertTitle>
                  <AlertDescription>{domainStatus.error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {domainStatus && domainStatus.status !== 'active' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              DNS Configuration Required
            </CardTitle>
            <CardDescription>
              Set up the following CNAME record with your domain provider
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>DNS Record Setup</AlertTitle>
              <AlertDescription>
                <div className="space-y-3 mt-3">
                  <div>
                    <strong>Record Type:</strong> CNAME
                  </div>
                  <div>
                    <strong>Name/Host:</strong> {customDomain.split('.')[0]} (or the subdomain part)
                  </div>
                  <div className="flex items-center gap-2">
                    <strong>Value/Target:</strong>
                    <code className="bg-muted px-2 py-1 rounded text-sm">
                      {currentDomain}.modl.gg
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(`${currentDomain}.modl.gg`)}
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div>
                    <strong>TTL:</strong> 300 (or lowest available)
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>SSL/TLS Certificate</CardTitle>
          <CardDescription>
            Automatic certificate management with Caddy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {domainStatus?.sslStatus === 'active' ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">SSL Certificate Active</p>
                    <p className="text-sm text-muted-foreground">
                      Your domain is secured with an automatically managed SSL certificate
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="font-medium">SSL Certificate Pending</p>
                    <p className="text-sm text-muted-foreground">
                      SSL certificate will be automatically generated once DNS is configured
                    </p>
                  </div>
                </>
              )}
            </div>

            <Alert>
              <AlertTitle>How it works</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li>Caddy automatically requests individual SSL certificates from Let's Encrypt for custom domains</li>
                  <li>Certificates are renewed automatically before expiration</li>
                  <li>HTTPS is enforced for all traffic to your custom domain</li>
                  <li>HTTP requests are automatically redirected to HTTPS</li>
                  <li>Note: *.modl.gg domains already have wildcard SSL certificates configured</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
          <CardDescription>
            Step-by-step guide to configure your custom domain
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">1. Configure Domain</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Enter your desired custom domain in the form above and click "Configure Domain".
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-3">2. Set DNS Record</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Create a CNAME record with your domain provider pointing to your current subdomain.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-3">3. Verify Configuration</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Click "Verify" to check if the DNS record is properly configured.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-3">4. SSL Activation</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Caddy will automatically obtain and install an SSL certificate for your domain.
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-3">Important Notes</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• DNS changes can take up to 48 hours to propagate globally</li>
                <li>• SSL certificate generation may take a few minutes after DNS verification</li>
                <li>• Your panel will remain accessible via the original subdomain</li>
                <li>• Custom domain can be removed at any time without affecting functionality</li>
                <li>• Only Super Admins and Admins can configure custom domains</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DomainSettings;
