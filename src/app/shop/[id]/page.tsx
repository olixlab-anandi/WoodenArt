'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDispatch, useAppSelector } from '@/redux/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Heart, ShoppingCart, Star, Minus, Plus, Trash2, Edit2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'react-toastify';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function ProductDetailPage() {
  const params = useParams();
  // MongoDB ObjectIds are strings, not integers
  const productId = params.id as string;
  const { user } = useAuth();
  const wishlist = useAppSelector((state) => state.wishlist.items);
  const [product, setProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [ratings, setRatings] = useState<any[]>([]);
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [userRating, setUserRating] = useState<any>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

  useEffect(() => {
    if (productId) {
      fetchProduct();
      fetchRatings();
    }
  }, [productId]);

  useEffect(() => {
    if (user && ratings.length > 0) {
      const myRating = ratings.find(r => String(r.userId) === String(user.id));
      if (myRating) {
        setUserRating(myRating);
        setRatingValue(myRating.rating);
        setReviewText(myRating.review || '');
      }
    }
  }, [user, ratings]);

  // When product changes, reset active image so a refresh shows the original image
  useEffect(() => {
    setActiveImage(null);
  }, [product]);

  const fetchProduct = async () => {
    if (!productId) return;
    try {
      const res = await fetch(`/api/products/${productId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.product) {
          setProduct(data.product);
        } else {
          toast.error('Product not found');
        }
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Failed to load product');
      }
    } catch (error) {
      console.error('Product fetch error:', error);
      toast.error('Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const fetchRatings = async () => {
    if (!productId) return;
    setLoadingRatings(true);
    try {
      const res = await fetch(`/api/ratings?productId=${productId}`);
      if (res.ok) {
        const data = await res.json();
        setRatings(data.ratings || []);
      }
    } catch (error) {
      console.error('Ratings fetch error:', error);
    } finally {
      setLoadingRatings(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!user) {
      toast.error('Please login to submit a review');
      return;
    }

    setSubmittingReview(true);
    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          productId,
          rating: ratingValue,
          review: reviewText.trim() || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(userRating ? 'Review updated successfully!' : 'Review submitted successfully!');
        setReviewDialogOpen(false);
        await fetchRatings();
        await fetchProduct(); // Refresh product to update average rating
        setUserRating(data.rating);
      } else {
        toast.error(data.error || 'Failed to submit review');
      }
    } catch (error) {
      console.error('Review submission error:', error);
      toast.error('Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteReview = async (ratingId: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete your review?')) return;

    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/ratings/${ratingId}`, {
        method: 'DELETE',
        headers,
      });

      if (res.ok) {
        toast.success('Review deleted successfully!');
        setUserRating(null);
        setReviewText('');
        setRatingValue(5);
        await fetchRatings();
        await fetchProduct(); // Refresh product to update average rating
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete review');
      }
    } catch (error) {
      console.error('Review deletion error:', error);
      toast.error('Failed to delete review');
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      toast.error('Please login to add items to cart');
      return;
    }

    setAdding(true);
    try {
      // Use GraphQL mutation instead of REST API
      const mutation = `mutation AddToCart($productId: ID!, $quantity: Int) {
        addToCart(productId: $productId, quantity: $quantity) {
          productId
          quantity
        }
      }`;
      
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
          query: mutation,
          variables: { productId: productId, quantity },
        }),
      });

      const data = await res.json();
      if (data.errors) {
        toast.error(data.errors[0]?.message || 'Failed to add to cart');
      } else if (data.data?.addToCart) {
        toast.success('Added to cart!');
      } else {
        toast.error('Failed to add to cart');
      }
    } catch (error) {
      console.error('Cart error:', error);
      toast.error('Failed to add to cart');
    } finally {
      setAdding(false);
    }
  };

  const handleToggleWishlist = async () => {
    if (!user) {
      toast.error('Please login to add items to wishlist');
      return;
    }

    // Compare using string IDs (MongoDB ObjectIds)
    const isInWishlist = wishlist.some(item => 
      String(item.productId) === String(productId) || String(item.productId) === String(product?.id)
    );

    try {
      // Use GraphQL mutation instead of REST API
      const mutation = isInWishlist
        ? `mutation RemoveFromWishlist($productId: ID!) {
            removeFromWishlist(productId: $productId)
          }`
        : `mutation AddToWishlist($productId: ID!) {
            addToWishlist(productId: $productId)
          }`;
      
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
          query: mutation,
          variables: { productId: productId },
        }),
      });

      const data = await res.json();
      if (data.errors) {
        toast.error(data.errors[0]?.message || 'Failed to update wishlist');
      } else {
        toast.success(isInWishlist ? 'Removed from wishlist' : 'Added to wishlist!');
      }
    } catch (error) {
      console.error('Wishlist error:', error);
      toast.error('Failed to update wishlist');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loader"></span>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Product not found</p>
      </div>
    );
  }

  const finalPrice = product.discount
    ? product.price - (product.price * product.discount / 100)
    : product.price;
  const isInWishlist = wishlist.some(item => 
    String(item.productId) === String(product.id) || item.productId === product.id
  );
  const images = product.images && Array.isArray(product.images) ? product.images : [];
  const mainImage = product.featureImage || (images.length > 0 ? images[0] : null);
  const displayImage = activeImage ?? mainImage;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-100">
      <Navbar showLogo={true} />
      
      <div className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Images */}
            <div>
              <div className="relative w-full h-96 bg-white rounded-lg mb-4">
                {displayImage ? (
                  <Image
                    key={displayImage}
                    src={displayImage}
                    alt={product.name}
                    fill
                    className="object-contain rounded-lg"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    No Image
                  </div>
                )}
                {product.discount > 0 && (
                  <Badge className="absolute top-4 right-4 bg-red-500">
                    {product.discount}% OFF
                  </Badge>
                )}
              </div>
              {images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {images.map((img: string, idx: number) => {
                    const isActive = (activeImage ?? '') === img;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImage(img)}
                        className={`relative w-full h-20 bg-white rounded focus:outline-none ${isActive ? 'ring-2 ring-amber-600' : ''}`}
                        aria-label={`View image ${idx + 1}`}
                      >
                        <Image src={img} alt={`${product.name} ${idx + 1}`} fill className="object-contain rounded" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Details */}
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">{product.name}</h1>
              
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold text-gray-900">
                    ₹{finalPrice.toFixed(2)}
                  </span>
                  {product.discount > 0 && (
                    <span className="text-lg text-gray-500 line-through">
                      ₹{product.price.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 mb-6">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const avgRating = product.averageRating || 0;
                    return (
                      <Star
                        key={star}
                        className={`w-5 h-5 ${
                          star <= Math.round(avgRating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    );
                  })}
                </div>
                <span className="text-lg font-medium">{product.averageRating?.toFixed(1) || '0.0'}</span>
                <span className="text-gray-500">({product.totalRatings || 0} reviews)</span>
              </div>

              {product.description && (
                <p className="text-gray-700 mb-6 leading-relaxed">{product.description}</p>
              )}

              <div className="space-y-4 mb-6">
                {product.material && (
                  <div>
                    <span className="font-semibold">Material:</span> {product.material}
                  </div>
                )}
                {product.color && (
                  <div>
                    <span className="font-semibold">Color:</span> {product.color}
                  </div>
                )}
                {product.style && (
                  <div>
                    <span className="font-semibold">Style:</span> {product.style}
                  </div>
                )}
                <div>
                  <span className="font-semibold">Stock:</span>{' '}
                  {product.stock > 0 ? (
                    <span className="text-green-600">{product.stock} available</span>
                  ) : (
                    <span className="text-red-600">Out of Stock</span>
                  )}
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="flex items-center gap-4 mb-6">
                <span className="font-semibold">Quantity:</span>
                <div className="flex items-center gap-2 border rounded-lg">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="w-12 text-center">{quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <Button
                  className="flex-1"
                  size="lg"
                  onClick={handleAddToCart}
                  disabled={adding || product.stock <= 0}
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Add to Cart
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleToggleWishlist}
                >
                  <Heart
                    className={`w-5 h-5 ${isInWishlist ? 'fill-red-500 text-red-500' : ''}`}
                  />
                </Button>
              </div>
            </div>
          </div>

          {/* Reviews Section */}
          <div className="mt-16">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Customer Reviews</h2>
              {user && (
                <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      {userRating ? <Edit2 className="w-4 h-4 mr-2" /> : <Star className="w-4 h-4 mr-2" />}
                      {userRating ? 'Edit Review' : 'Write a Review'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{userRating ? 'Edit Your Review' : 'Write a Review'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Rating</label>
                        <div className="flex items-center gap-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setRatingValue(star)}
                              className="focus:outline-none"
                            >
                              <Star
                                className={`w-8 h-8 transition-colors ${
                                  star <= ratingValue
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-gray-300 hover:text-yellow-200'
                                }`}
                              />
                            </button>
                          ))}
                          <span className="ml-2 text-sm text-gray-600">{ratingValue} out of 5</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Review (Optional)</label>
                        <Textarea
                          value={reviewText}
                          onChange={(e) => setReviewText(e.target.value)}
                          placeholder="Share your experience with this product..."
                          rows={5}
                          className="resize-none"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setReviewDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSubmitReview}
                          disabled={submittingReview}
                        >
                          {submittingReview ? 'Submitting...' : userRating ? 'Update Review' : 'Submit Review'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {loadingRatings ? (
              <div className="text-center py-12">
                <span className="loader"></span>
              </div>
            ) : ratings.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No reviews yet</p>
                <p className="text-gray-400 text-sm mt-2">Be the first to review this product!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {ratings.map((rating) => (
                  <div
                    key={rating.id}
                    className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                            <span className="text-amber-700 font-semibold">
                              {rating.user?.firstName?.[0]?.toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {rating.user?.firstName} {rating.user?.lastName}
                            </p>
                            <p className="text-sm text-gray-500">
                              {new Date(rating.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mb-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${
                                star <= rating.rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        {rating.review && (
                          <p className="text-gray-700 leading-relaxed mt-2">{rating.review}</p>
                        )}
                      </div>
                      {user && (String(rating.userId) === String(user.id) || user.role === 'ADMIN') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteReview(rating.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}



