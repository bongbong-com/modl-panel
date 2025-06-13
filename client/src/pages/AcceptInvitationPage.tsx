import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import PageContainer from '@/components/layout/PageContainer';

const AcceptInvitationPage = () => {
  const [status, setStatus] = useState('Verifying your invitation...');
  const [, navigate] = useLocation();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');

    if (!token) {
      setStatus('This invitation link is invalid or has expired.');
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await fetch(`/api/staff/invitations/accept?token=${token}`, {
          method: 'GET',
        });
        if (response.ok) {
          setStatus('Invitation accepted! Redirecting...');
          window.location.href = '/';
        } else {
          const errorData = await response.json();
          setStatus(errorData.message || 'This invitation link is invalid or has expired.');
        }
      } catch (error) {
        setStatus('An error occurred while trying to accept the invitation.');
      }
    };

    verifyToken();
  }, [navigate]);

  return (
    <PageContainer>
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Accept Invitation</h1>
          <p>{status}</p>
        </div>
      </div>
    </PageContainer>
  );
};

export default AcceptInvitationPage;