import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const BillingSettings = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
        <CardDescription>Manage your subscription and billing details.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Billing is currently disabled.</p>
      </CardContent>
    </Card>
  );
};

export default BillingSettings;