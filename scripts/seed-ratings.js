const mongoose = require('mongoose');

// MongoDB connection
const MONGODB_URI = process.env.DATABASE_URL || 
  process.env.DATABASE_URl || 
  process.env.MONGODB_URI || 
  process.env.MONGO_URL || 
  'mongodb://localhost:27017/woodenart';

// Define schemas (matching the models)
const RatingSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  review: { type: String },
}, { timestamps: true, collection: 'ratings' });

RatingSchema.index({ productId: 1, userId: 1 }, { unique: true });

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  discount: { type: Number },
  stock: { type: Number, default: 0 },
  featureImage: { type: String },
  images: [{ type: String }],
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  averageRating: { type: Number, default: 0 },
  totalRatings: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true, collection: 'products' });

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true, collection: 'users' });

const Rating = mongoose.models.Rating || mongoose.model('Rating', RatingSchema);
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
const User = mongoose.models.User || mongoose.model('User', UserSchema);

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

async function seedRatings() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      dbName: process.env.MONGODB_DB || undefined,
    });
    console.log('Connected to MongoDB');

    // Get all products
    const products = await Product.find({ isActive: true }).limit(20).lean();
    if (products.length === 0) {
      console.log('No products found. Please create some products first.');
      await mongoose.disconnect();
      return;
    }
    console.log(`Found ${products.length} products`);

    // Get all users
    const users = await User.find({ isActive: true, role: 'USER' }).limit(10).lean();
    if (users.length === 0) {
      console.log('No users found. Please create some users first.');
      await mongoose.disconnect();
      return;
    }
    console.log(`Found ${users.length} users`);

    // Clear existing ratings (optional - comment out if you want to keep existing)
    const deletedCount = await Rating.deleteMany({});
    console.log(`Cleared ${deletedCount.deletedCount} existing ratings`);

    let totalRatingsCreated = 0;

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
        } catch (error) {
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

      console.log(`Created ${selectedUsers.length} ratings for product: ${product.name} (Avg: ${averageRating.toFixed(1)}, Total: ${totalRatings})`);
    }

    console.log(`\n✅ Successfully created ${totalRatingsCreated} ratings across ${products.length} products!`);
    console.log('You can now view the ratings and reviews on product pages and in the admin panel.');

  } catch (error) {
    console.error('Error seeding ratings:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seedRatings();


