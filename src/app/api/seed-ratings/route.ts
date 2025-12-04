import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Rating } from '@/models/Rating';
import { Product } from '@/models/Product';
import { User } from '@/models/User';
import { authenticateRequest } from '@/lib/auth';

// Sample reviews data
const sampleReviews = [
  { rating: 5, review: "Absolutely stunning craftsmanship! The quality is exceptional and it looks even better in person. Highly recommend!" },
  { rating: 5, review: "Beautiful piece of furniture. The wood grain is gorgeous and it's very well made. Worth every penny!" },
  { rating: 4, review: "Great product overall. The design is elegant and it fits perfectly in my living room. Minor issue with delivery but product is excellent." },
  { rating: 5, review: "Perfect addition to my home! The attention to detail is remarkable. Very satisfied with my purchase." },
  { rating: 4, review: "Love the design and quality. It's sturdy and looks premium. Would buy again!" },
  { rating: 3, review: "Decent product but took longer than expected to arrive. Quality is good though." },
  { rating: 5, review: "Exceeded my expectations! The craftsmanship is top-notch and it's exactly as described. Very happy customer!" },
  { rating: 4, review: "Beautiful wooden furniture. The finish is smooth and it's very durable. Great value for money." },
  { rating: 5, review: "Amazing quality! This is a centerpiece in my home. Everyone compliments it. Highly satisfied!" },
  { rating: 4, review: "Good product with nice design. The wood quality is excellent. Minor assembly required but overall great." },
  { rating: 2, review: "Not quite what I expected. The quality is okay but there were some scratches on delivery. Customer service helped resolve it." },
  { rating: 5, review: "Outstanding quality and craftsmanship! This is exactly what I was looking for. Very pleased with my purchase!" },
  { rating: 4, review: "Solid construction and beautiful design. It's a statement piece that adds elegance to any room." },
  { rating: 5, review: "Perfect! The woodwork is exquisite and it's built to last. Worth the investment!" },
  { rating: 3, review: "It's okay. The design is nice but I expected better quality for the price. Still functional though." },
  { rating: 5, review: "Absolutely love it! The attention to detail is incredible. This will last for generations!" },
  { rating: 4, review: "Great product! The finish is beautiful and it's very well constructed. Happy with my purchase." },
  { rating: 5, review: "Exceptional quality! The craftsmanship shows in every detail. Highly recommend to anyone looking for quality furniture." },
  { rating: 4, review: "Beautiful piece that adds character to my space. The wood grain is lovely and it's very sturdy." },
  { rating: 5, review: "Best purchase I've made! The quality is outstanding and it looks amazing in my home. Very satisfied!" },
];

const shortReviews = [
  "Great quality!",
  "Love it!",
  "Beautiful piece!",
  "Highly recommend!",
  "Excellent craftsmanship!",
  "Perfect fit!",
  "Amazing quality!",
  "Very satisfied!",
  "Great value!",
  "Beautiful design!",
];

export async function POST(req: NextRequest) {
  try {
    // Optional: Check if user is admin (comment out for easier testing)
    // const user = await authenticateRequest(req);
    // if (!user || user.role !== 'ADMIN') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    await connectToDatabase();

    // Get all active products
    const products = await Product.find({ isActive: true }).limit(20).lean();
    if (products.length === 0) {
      return NextResponse.json({ error: 'No products found. Please create some products first.' }, { status: 400 });
    }

    // Get all active users
    const users = await User.find({ isActive: true, role: 'USER' }).limit(10).lean();
    if (users.length === 0) {
      return NextResponse.json({ error: 'No users found. Please create some users first.' }, { status: 400 });
    }

    // Clear existing ratings (optional - comment out if you want to keep existing)
    const deletedCount = await Rating.deleteMany({});

    let totalRatingsCreated = 0;
    const results: Array<{ productName: string; ratingsCount: number; averageRating: number }> = [];

    // Create ratings for each product
    for (const product of products) {
      // Random number of reviews per product (2-8)
      const numReviews = Math.floor(Math.random() * 7) + 2;
      
      // Shuffle users to get random selection
      const shuffledUsers = [...users].sort(() => 0.5 - Math.random());
      const selectedUsers = shuffledUsers.slice(0, Math.min(numReviews, users.length));

      for (let i = 0; i < selectedUsers.length; i++) {
        const user = selectedUsers[i];
        const reviewData = i < sampleReviews.length 
          ? sampleReviews[i % sampleReviews.length]
          : { 
              rating: Math.floor(Math.random() * 3) + 3, // 3-5 stars
              review: shortReviews[Math.floor(Math.random() * shortReviews.length)]
            };

        try {
          await Rating.create({
            productId: product._id,
            userId: user._id,
            rating: reviewData.rating,
            review: reviewData.review,
          });
          totalRatingsCreated++;
        } catch (error: any) {
          if (error.code === 11000) {
            // Duplicate key - user already rated this product, skip
            continue;
          }
          throw error;
        }
      }

      // Update product average rating
      const productRatings = await Rating.find({ productId: product._id }).lean();
      const totalRatings = productRatings.length;
      const sumRatings = productRatings.reduce((sum, r) => sum + r.rating, 0);
      const averageRating = totalRatings > 0 ? Math.round((sumRatings / totalRatings) * 10) / 10 : 0;

      await Product.findByIdAndUpdate(product._id, {
        averageRating,
        totalRatings,
      });

      results.push({
        productName: product.name,
        ratingsCount: totalRatings,
        averageRating,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully created ${totalRatingsCreated} ratings across ${products.length} products!`,
      deletedExisting: deletedCount.deletedCount,
      totalRatingsCreated,
      productsSeeded: products.length,
      results,
    });
  } catch (error: any) {
    console.error('Error seeding ratings:', error);
    return NextResponse.json(
      { error: 'Failed to seed ratings', details: error.message },
      { status: 500 }
    );
  }
}


