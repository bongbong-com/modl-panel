import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import PageContainer from '@/components/layout/PageContainer'; // Import PageContainer
import { Loader2 } from 'lucide-react'; // Import a loader icon

const ProvisioningInProgressPage: React.FC = () => {
  const [, navigate] = useLocation();
  const [statusMessage, setStatusMessage] = useState('Initializing server setup...');
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Get serverName from URL query parameter
  const [searchParams] = useState(new URLSearchParams(window.location.search));
  const serverName = searchParams.get('server');

  const checkStatus = useCallback(async () => {
    if (!serverName) {
      setError('Server name not found in URL. Cannot check provisioning status.');
      setStatusMessage('Configuration error.');
      return;
    }
    try {
      // API call is to the same subdomain, e.g., byteful.modl.gg/api/provisioning/status/byteful
      const response = await fetch(`/api/provisioning/status/${serverName}`); 
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          // If response is not JSON
          errorData = { error: `Server returned an error: ${response.statusText || response.status}` };
        }
        // For 5xx errors from server (like provisioning failed), display that error.
        // For network or other client-side issues, retry or show generic error.
        if (response.status >= 500 && errorData.error) {
            throw new Error(errorData.error); // Error from server's provisioning status
        }
        throw new Error(errorData.error || `Failed to check status. HTTP error: ${response.status}`);
      }
      
      const data = await response.json();

      if (data.status === 'completed') { // Updated to check data.status
        setStatusMessage(`Server '${serverName}' is ready! Redirecting to dashboard...`);
        setTimeout(() => {
          // Navigate to the root of the subdomain, which should be the panel homepage
          window.location.href = '/'; 
        }, 2000); // Short delay to read the message
      } else if (data.status === 'in-progress') { // Added specific check for in-progress
        setStatusMessage(data.message || 'Provisioning in progress, please wait...');
        setError(null); 
        setRetryCount(0); 
        setTimeout(checkStatus, 3000); 
      } else if (data.status === 'failed') { // Added specific check for failed
        setError(data.message || 'Provisioning failed. Please contact support or try again.');
        setStatusMessage('Failed to complete server setup.');
      } else {
        // Handle other statuses or unexpected responses
        setStatusMessage(data.message || 'Checking server status...');
        setError(null);
        setRetryCount(0);
        setTimeout(checkStatus, 5000); // Poll again with a slightly longer delay for unknown status
      }
    } catch (err: any) {
      console.error('Error checking provisioning status:', err);
      if (retryCount < maxRetries) {
        setStatusMessage(`Connection issue. Retrying (${retryCount + 1}/${maxRetries})...`);
        setRetryCount(prev => prev + 1);
        setTimeout(checkStatus, 5000 * (retryCount + 1)); // Exponential backoff for retries
      } else {
        setError(err.message || 'An unexpected error occurred while checking server status. Please try refreshing or contact support.');
        setStatusMessage('Failed to complete server setup.');
      }
    }
  }, [navigate, retryCount, serverName]); // Removed checkStatus from dependencies as it's defined in the callback

  useEffect(() => {
    if (serverName) {
      checkStatus(); // Initial check only if serverName is present
    } else {
      setError('Critical: Server identifier is missing from the URL.');
      setStatusMessage('Cannot proceed with server setup check.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [serverName, checkStatus]); // Added checkStatus to dependencies

  return (
    <PageContainer title="Server Setup">
      <div className="flex flex-col items-center justify-center text-center p-4">
        <h1 className="text-2xl font-semibold mb-4">Setting Up Your Server: {serverName || "Unknown"}</h1>
        <p className="text-lg mb-6 text-muted-foreground">{statusMessage}</p>
        
        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive p-4 rounded-md mb-6 w-full max-w-md">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}
        
        {!error && !statusMessage.includes("Redirecting") && !statusMessage.includes("Failed") && (
          <div className="flex flex-col items-center mt-6">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">This may take a few moments...</p>
          </div>
        )}

        {error && (
          <button 
            onClick={() => {
              setRetryCount(0);
              setError(null);
              setStatusMessage('Retrying setup...');
              checkStatus();
            }}
            className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </PageContainer>
  );
};

export default ProvisioningInProgressPage;
