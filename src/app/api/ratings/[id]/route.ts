import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Rating } from '@/models/Rating';
import { Product } from '@/models/Product';
import { authenticateRequest } from '@/lib/auth';
import { cacheDeletePattern } from '@/lib/redis';

// DELETE - Delete a rating (admin or owner)
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    await connectToDatabase();

    const rating = await Rating.findById(id).lean();
    if (!rating) {
      return NextResponse.json({ error: 'Rating not found' }, { status: 404 });
    }

    // Check if user is admin or owner
    const isOwner = String(rating.userId) === String(user.id);
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const productId = String(rating.productId);

    // Delete the rating
    await Rating.findByIdAndDelete(id);

    // Update product average rating
    const allRatings = await Rating.find({ productId }).lean();
    const totalRatings = allRatings.length;
    const sumRatings = allRatings.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRatings > 0 ? sumRatings / totalRatings : 0;

    await Product.findByIdAndUpdate(productId, {
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      totalRatings,
    });

    // Invalidate caches
    await cacheDeletePattern(`api:product:${productId}`);
    await cacheDeletePattern(`api:products:*`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Rating deletion error:', error);
    return NextResponse.json({ error: 'Failed to delete rating' }, { status: 500 });
  }
}


