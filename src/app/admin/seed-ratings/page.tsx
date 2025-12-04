'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { Button } from '@/components/ui/button';
import { toast } from 'react-toastify';

export default function SeedRatingsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);
  const [result, setResult] = useState<any>(null);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loader"></span>
      </div>
    );
  }

  const isAuthenticated = Cookies.get('isAuthenticated') === 'true' || localStorage.getItem('isAuthenticated') === 'true';
  const role = Cookies.get('role') || localStorage.getItem('role');
  const isUserAdmin = isAdmin || (user?.role === 'ADMIN') || (isAuthenticated && role === 'ADMIN');

  if (!isUserAdmin) {
    router.push('/');
    return null;
  }

  const handleSeedRatings = async () => {
    if (!confirm('This will clear all existing ratings and create new dummy data. Continue?')) {
      return;
    }

    setSeeding(true);
    setResult(null);
    try {
      const res = await fetch('/api/seed-ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (res.ok) {
        setResult(data);
        toast.success(data.message || 'Ratings seeded successfully!');
      } else {
        toast.error(data.error || 'Failed to seed ratings');
      }
    } catch (error) {
      console.error('Seed error:', error);
      toast.error('Failed to seed ratings');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Seed Dummy Ratings & Reviews</h1>
        <p className="text-gray-600 mt-1">Generate sample ratings and reviews for testing</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-2">What this does:</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Clears all existing ratings and reviews</li>
              <li>Creates 2-8 reviews per product (random)</li>
              <li>Uses sample review text with ratings from 2-5 stars</li>
              <li>Updates product average ratings automatically</li>
              <li>Distributes reviews across different users</li>
            </ul>
          </div>

          <div className="pt-4 border-t">
            <Button
              onClick={handleSeedRatings}
              disabled={seeding}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {seeding ? 'Seeding...' : 'Seed Dummy Ratings & Reviews'}
            </Button>
          </div>

          {result && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">✅ Seeding Complete!</h3>
              <div className="space-y-1 text-sm text-green-800">
                <p><strong>Total Ratings Created:</strong> {result.totalRatingsCreated}</p>
                <p><strong>Products Seeded:</strong> {result.productsSeeded}</p>
                <p><strong>Existing Ratings Deleted:</strong> {result.deletedExisting}</p>
              </div>
              
              {result.results && result.results.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold text-green-900 mb-2">Product Ratings:</h4>
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {result.results.map((r: any, idx: number) => (
                      <div key={idx} className="text-xs bg-white p-2 rounded border border-green-100">
                        <span className="font-medium">{r.productName}:</span> {r.ratingsCount} reviews, Avg: {r.averageRating.toFixed(1)} ⭐
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


