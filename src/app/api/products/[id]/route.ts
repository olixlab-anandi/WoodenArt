import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Product } from '@/models/Product';
import { Category } from '@/models/Category';
import { Rating } from '@/models/Rating';
import { cacheGetJSON, cacheSetJSON } from '@/lib/redis';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    // Check cache first
    const cacheKey = `api:product:${id}`;
    const cached = await cacheGetJSON<{ product: any }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    await connectToDatabase();

    const product = await Product.findById(id).lean();

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Fetch category name
    let category: { id: string; name: string } | null = null;
    if (product.categoryId) {
      const cat = await Category.findById(product.categoryId).select({ _id: 1, name: 1 }).lean();
      if (cat) category = { id: String(cat._id), name: cat.name };
    }

    // Fetch ratings count and average (already in product, but ensure it's up to date)
    const ratingsCount = await Rating.countDocuments({ productId: id });
    const ratings = await Rating.find({ productId: id }).lean();
    const avgRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0;

    const result = {
      product: {
        id: String(product._id),
        name: product.name,
        description: product.description ?? null,
        price: Number(product.price),
        discount: product.discount != null ? Number(product.discount) : null,
        stock: product.stock,
        featureImage: product.featureImage ?? null,
        images: product.images ?? [],
        material: product.material ?? null,
        color: product.color ?? null,
        style: product.style ?? null,
        specialFeature: product.specialFeature ?? null,
        averageRating: Math.round(avgRating * 10) / 10,
        totalRatings: ratingsCount,
        category,
      },
    };

    // Cache for 5 minutes (300 seconds)
    await cacheSetJSON(cacheKey, result, 300);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Product fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}


