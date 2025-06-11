import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'wouter';

const ProvisioningInProgressPage: React.FC = () => {
  const [, navigate] = useLocation();
  const [statusMessage, setStatusMessage] = useState('Initializing server setup...');
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3; // Max retries for network issues before showing a generic error

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
  }, [navigate, retryCount, serverName]);

  useEffect(() => {
    if (serverName) {
      checkStatus(); // Initial check only if serverName is present
    } else {
      setError('Critical: Server identifier is missing from the URL.');
      setStatusMessage('Cannot proceed with server setup check.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [serverName]); // Rerun if serverName changes (though it shouldn't in this page context)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '20px', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
      <h1>Setting Up Your Server</h1>
      <p style={{ fontSize: '1.1em', margin: '20px 0' }}>{statusMessage}</p>
      {error && <p style={{ color: 'red', marginTop: '10px', fontWeight: 'bold' }}>Error: {error}</p>}
      
      {!error && !statusMessage.includes("Redirecting") && !statusMessage.includes("Failed") && (
        <div style={{ marginTop: '20px' }}>
          <p>This may take a few moments...</p>
          <div className="spinner" style={{
            border: '4px solid rgba(0,0,0,.1)',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            borderLeftColor: '#007bff', // Blue color for spinner
            animation: 'spin 1s linear infinite',
            margin: '20px auto'
          }}></div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
      {error && (
         <button 
            onClick={() => { 
                setRetryCount(0); 
                setError(null); 
                setStatusMessage('Retrying setup check...'); 
                checkStatus(); 
            }}
            style={{ marginTop: '20px', padding: '10px 20px', fontSize: '1em', cursor: 'pointer' }}
          >
            Retry Manually
          </button>
      )}
    </div>
  );
};

export default ProvisioningInProgressPage;
