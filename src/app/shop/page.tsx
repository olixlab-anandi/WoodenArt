'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/redux/store';
import { listProducts } from '@/redux/features/product/productActions';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'react-toastify';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CardFlip from '@/components/Animations/card/CardFlip';

export default function ShopPage() {
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const products = useAppSelector((state) => state.product.items);
  const wishlist = useAppSelector((state) => state.wishlist.items);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    dispatch(listProducts());
  }, [dispatch]);

  // Initialize selected category from URL query (?category=...)
  useEffect(() => {
    const cat = searchParams.get('category');
    setSelectedCategory(cat);
  }, [searchParams]);

  const activeProducts = products.filter(p => p.status === 'Active');
  const categories = Array.from(new Set(activeProducts.map(p => p.category)));

  const handleAddToCart = async (productId: string ) => {
    if (!user) {
      toast.error('Please login to add items to cart');
      return;
    }

    setLoading(true);
    try {
      // Get token from localStorage
      const token = localStorage.getItem('token');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch('/api/graphql', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          query: `mutation AddToCart($pid: ID!, $qty: Int){ addToCart(productId: $pid, quantity: $qty){ productId quantity } }`,
          variables: { pid: String(productId), qty: 1 },
        }),
      });
      const json = await res.json();
      if (json.errors) throw new Error(json.errors[0]?.message || 'Failed');
      toast.success('Added to cart!');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add to cart');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWishlist = async (productId: string ) => {
    if (!user) {
      toast.error('Please login to add items to wishlist');
      return;
    }

    const isInWishlist = wishlist.some(item => String(item.productId) === String(productId));

    setLoading(true);
    try {
      // Get token from localStorage
      const token = localStorage.getItem('token');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const query = isInWishlist
        ? `mutation Remove($pid: ID!){ removeFromWishlist(productId: $pid) }`
        : `mutation Add($pid: ID!){ addToWishlist(productId: $pid) }`;
        const res = await fetch('/api/graphql', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ query, variables: { pid: String(productId) } }),
      });
      const json = await res.json();
      if (json.errors) throw new Error(json.errors[0]?.message || 'Failed');
      toast.success(isInWishlist ? 'Removed from wishlist' : 'Added to wishlist!');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update wishlist');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = selectedCategory
    ? activeProducts.filter(p => p.category === selectedCategory)
    : activeProducts;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-100">
      <Navbar showLogo={true} />
      
      <div className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Shop Wooden Products</h1>
            <p className="text-gray-600">Discover our handcrafted wooden products</p>
          </div>

          {/* Category Filter */}
          {categories.length > 0 && (
            <div className="mb-8 flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === null ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(null)}
              >
                All Products
              </Button>
              {categories.map(category => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          )}

          {/* Products Grid */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-500 text-lg">No products available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {filteredProducts.map((product, index) => {
                const finalPrice = product.finalPrice || product.price;
                const discount = Number(product.discount) || 0;
                const isInWishlist = wishlist.some(item => item.productId === product.id);

                return (
                  <div
                    key={product.id}
                    style={{
                      animationName: 'fadeInUp',
                      animationDuration: '0.6s',
                      animationTimingFunction: 'ease-out',
                      animationFillMode: 'forwards',
                      animationDelay: `${index * 100}ms`,
                    }}
                  >
                    <CardFlip
                      id={product.id}
                      image={product.image || product.featureImage || null}
                      title={product.name}
                      description={product.description || null}
                      price={product.price}
                      discount={discount}
                      rating={Number(product.averageRating) || 0}
                      reviewsCount={Number(product.totalRatings) || 0}
                      stock={product.stock || 0}
                      category={product.category}
                      onAddToCart={() => handleAddToCart(product.id)}
                      onToggleWishlist={() => handleToggleWishlist(product.id)}
                      isInWishlist={isInWishlist}
                      isLoading={loading}
                      productUrl={`/shop/${product.id}`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}


