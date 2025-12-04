import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Product } from '@/models/Product';
import { Category } from '@/models/Category';
import { Rating } from '@/models/Rating';
import { cacheGetJSON, cacheSetJSON } from '@/lib/redis';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const first = parseInt(searchParams.get('first') || '100');

    // Check cache first
    const cacheKey = `api:products:${first}`;
    const cached = await cacheGetJSON<{ items: any[] }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    await connectToDatabase();
    const products = await Product.find({}).sort({ createdAt: -1 }).limit(first).lean();

    // Fetch categories in one go
    const categoryIds = Array.from(new Set(products.map(p => p.categoryId).filter(Boolean))) as any[];
    const categories = categoryIds.length > 0
      ? await Category.find({ _id: { $in: categoryIds } }).select({ _id: 1, name: 1 }).lean()
      : [];
    const idToCategory = new Map(categories.map(c => [String(c._id), c.name]));

    // Fetch ratings for all products
    const productIds = products.map((p: any) => p._id).filter(Boolean);
    const ratings = productIds.length > 0
      ? await Rating.find({ productId: { $in: productIds } }).lean()
      : [];
    
    // Group ratings by productId
    const ratingsByProduct = new Map<string, { count: number; sum: number }>();
    ratings.forEach((r: any) => {
      const pid = String(r.productId);
      const current = ratingsByProduct.get(pid) || { count: 0, sum: 0 };
      ratingsByProduct.set(pid, {
        count: current.count + 1,
        sum: current.sum + r.rating,
      });
    });

    const rows = products.map((p: any) => {
      const price = Number(p.price || 0);
      const discount = p.discount != null ? Number(p.discount) : 0;
      const finalPrice = discount > 0 ? price - (price * discount) / 100 : price;
      const productId = p._id ? String(p._id) : '';
      const ratingData = ratingsByProduct.get(productId);
      const averageRating = ratingData && ratingData.count > 0
        ? Math.round((ratingData.sum / ratingData.count) * 10) / 10
        : (p.averageRating || 0);
      const totalRatings = ratingData?.count || p.totalRatings || 0;
      
      return {
        id: productId,
        name: p.name,
        description: p.description || '',
        price,
        discount: p.discount != null ? discount : undefined,
        discountType: 'PERCENT',
        finalPrice,
        category: idToCategory.get(String(p.categoryId)) || 'Uncategorized',
        stock: p.stock || 0,
        status: p.isActive ? 'Active' : 'Inactive',
        createdAt: p.createdAt ? new Date(p.createdAt).toISOString().slice(0,10) : undefined,
        image: p.featureImage || undefined,
        featureImage: p.featureImage || undefined,
        images: Array.isArray(p.images) ? p.images : [],
        averageRating,
        totalRatings,
      };
    });

    const result = { items: rows };
    
    // Cache for 5 minutes (300 seconds)
    await cacheSetJSON(cacheKey, result, 300);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Products list error:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}



