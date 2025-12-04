import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Rating } from '@/models/Rating';
import { Product } from '@/models/Product';
import { User } from '@/models/User';
import { authenticateRequest } from '@/lib/auth';
import { cacheDeletePattern } from '@/lib/redis';

// GET - Fetch ratings for a product or all ratings (admin)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    const all = searchParams.get('all') === 'true';

    await connectToDatabase();

    // If 'all' is requested, check if user is admin
    if (all) {
      const user = await authenticateRequest(req);
      if (!user || user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Fetch all ratings
      const ratings = await Rating.find({})
        .populate('userId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .lean();

      const formattedRatings = ratings.map((rating: any) => ({
        id: String(rating._id),
        productId: String(rating.productId),
        userId: String(rating.userId._id || rating.userId),
        user: {
          id: String(rating.userId._id || rating.userId),
          firstName: rating.userId.firstName || 'Anonymous',
          lastName: rating.userId.lastName || '',
          email: rating.userId.email || '',
        },
        rating: rating.rating,
        review: rating.review || null,
        createdAt: rating.createdAt,
        updatedAt: rating.updatedAt,
      }));

      return NextResponse.json({ ratings: formattedRatings });
    }

    // Fetch ratings for a specific product
    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const ratings = await Rating.find({ productId })
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    const formattedRatings = ratings.map((rating: any) => ({
      id: String(rating._id),
      productId: String(rating.productId),
      userId: String(rating.userId._id || rating.userId),
      user: {
        id: String(rating.userId._id || rating.userId),
        firstName: rating.userId.firstName || 'Anonymous',
        lastName: rating.userId.lastName || '',
        email: rating.userId.email || '',
      },
      rating: rating.rating,
      review: rating.review || null,
      createdAt: rating.createdAt,
      updatedAt: rating.updatedAt,
    }));

    return NextResponse.json({ ratings: formattedRatings });
  } catch (error) {
    console.error('Ratings fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch ratings' }, { status: 500 });
  }
}

// POST - Create or update a rating
export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { productId, rating, review } = body;

    if (!productId || !rating) {
      return NextResponse.json({ error: 'Product ID and rating are required' }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    await connectToDatabase();

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Find existing rating or create new one
    const existingRating = await Rating.findOne({ productId, userId: user.id });

    let ratingDoc;
    if (existingRating) {
      // Update existing rating
      const oldRating = existingRating.rating;
      existingRating.rating = rating;
      existingRating.review = review || null;
      ratingDoc = await existingRating.save();

      // Update product average rating
      const allRatings = await Rating.find({ productId }).lean();
      const totalRatings = allRatings.length;
      const sumRatings = allRatings.reduce((sum, r) => sum + r.rating, 0);
      const averageRating = totalRatings > 0 ? sumRatings / totalRatings : 0;

      await Product.findByIdAndUpdate(productId, {
        averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
        totalRatings,
      });
    } else {
      // Create new rating
      ratingDoc = await Rating.create({
        productId,
        userId: user.id,
        rating,
        review: review || null,
      });

      // Update product average rating
      const allRatings = await Rating.find({ productId }).lean();
      const totalRatings = allRatings.length;
      const sumRatings = allRatings.reduce((sum, r) => sum + r.rating, 0);
      const averageRating = totalRatings > 0 ? sumRatings / totalRatings : 0;

      await Product.findByIdAndUpdate(productId, {
        averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
        totalRatings,
      });
    }

    // Invalidate caches
    await cacheDeletePattern(`api:product:${productId}`);
    await cacheDeletePattern(`api:products:*`);

    // Populate user info
    const userDoc = await User.findById(user.id).lean();
    const formattedRating = {
      id: String(ratingDoc._id),
      productId: String(ratingDoc.productId),
      userId: String(ratingDoc.userId),
      user: {
        id: String(user.id),
        firstName: userDoc?.firstName || user.firstName || 'Anonymous',
        lastName: userDoc?.lastName || user.lastName || '',
        email: userDoc?.email || user.email || '',
      },
      rating: ratingDoc.rating,
      review: ratingDoc.review || null,
      createdAt: ratingDoc.createdAt,
      updatedAt: ratingDoc.updatedAt,
    };

    return NextResponse.json({ rating: formattedRating }, { status: existingRating ? 200 : 201 });
  } catch (error: any) {
    console.error('Rating creation/update error:', error);
    if (error.code === 11000) {
      return NextResponse.json({ error: 'You have already rated this product' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create/update rating' }, { status: 500 });
  }
}

