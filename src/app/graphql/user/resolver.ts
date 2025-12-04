import { Context } from './context';
import { AuthService } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { User } from '@/models/User';

// GraphQL argument types
interface UsersArgs {
  first?: number;
  after?: string;
  filter?: {
    search?: string;
    role?: 'USER' | 'ADMIN';
    isActive?: boolean;
  };
  sort?: {
    field: string;
    direction: 'ASC' | 'DESC';
  };
}

interface UserArgs {
  id: string;
}

interface LoginArgs {
  input: {
    email: string;
    password: string;
  };
}

interface RegisterArgs {
  input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  };
}

interface CreateUserArgs {
  input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: 'USER' | 'ADMIN';
    isActive?: boolean;
  };
}

interface UpdateUserArgs {
  input: {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    password?: string;
    role?: 'USER' | 'ADMIN';
    isActive?: boolean;
  };
}

interface DeleteUserArgs {
  id: string;
}

// Prisma where clause type
interface UserWhereClause {
  OR?: Array<{
    firstName?: { contains: string };
    lastName?: { contains: string };
    email?: { contains: string };
  }>;
  role?: 'USER' | 'ADMIN';
  isActive?: boolean;
}

export const userResolvers = {
  User: {
    id: (parent: any) => {
      // Handle both _id (MongoDB) and id (already transformed) cases
      return parent.id || String(parent._id);
    },
  },
  Query: {
    me: async (_: unknown, __: unknown, context: Context) => {
      if (!context.user) {
        return null;
      }
      return context.user;
    },

    users: async (_: unknown, args: UsersArgs, context: Context) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new Error('Unauthorized');
      }

      const { first = 10, after, filter = {}, sort = { field: 'createdAt', direction: 'DESC' } } = args;
      const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;

      await connectToDatabase();

      // Build Mongo filter
      const where: any = {};
      if (filter.search) {
        const regex = new RegExp(filter.search, 'i');
        where.$or = [
          { firstName: { $regex: regex } },
          { lastName: { $regex: regex } },
          { email: { $regex: regex } },
        ];
      }
      if (filter.role) where.role = filter.role;
      if (filter.isActive !== undefined) where.isActive = filter.isActive;

      const sortDir = (sort.direction?.toLowerCase?.() as 'asc' | 'desc') || 'desc';
      const sortSpec: Record<string, 1 | -1> = { [sort.field]: sortDir === 'asc' ? 1 : -1 };

      const [users, totalCount] = await Promise.all([
        User.find(where)
          .select('email firstName lastName role isActive createdAt updatedAt')
          .sort(sortSpec)
          .skip(skip)
          .limit(first)
          .lean(),
        User.countDocuments(where),
      ]);

      const edges = users.map((user: any, index) => ({
        node: {
          id: String(user._id),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        cursor: Buffer.from((skip + index).toString()).toString('base64'),
      }));

      const hasNextPage = skip + first < totalCount;
      const hasPreviousPage = skip > 0;

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount,
      };
    },

    user: async (_: unknown, args: UserArgs, context: Context) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new Error('Unauthorized');
      }

      await connectToDatabase();
      const user = await User.findById(args.id)
        .select('email firstName lastName role isActive createdAt updatedAt')
        .lean();

      if (!user) {
        throw new Error('User not found');
      }

      return {
        id: String((user as any)._id),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    },
  },

  Mutation: {
    refreshToken: async (_: unknown, args: { refreshToken: string }) => {
      try {
        const result = AuthService.refreshAccessToken(args.refreshToken);
        if (!result) throw new Error('Unauthorized');
        return { token: result.token };
      } catch (error) {
        if (error instanceof Error && error.message.includes('Unauthorized')) {
          throw error;
        }
        throw new Error('Internal Server Error');
      }
    },
    login: async (_: unknown, args: LoginArgs) => {
      try {
        const { email, password } = args.input;
        const result = await AuthService.login(email, password);
        return result;
      } catch (error) {
        // Check if it's a user-friendly error
        if (error instanceof Error && (
          error.message.includes('Invalid credentials') ||
          error.message.includes('User with this email already exists') ||
          error.message.includes('User not found') ||
          error.message.includes('Unauthorized')
        )) {
          throw new Error(error.message);
        }
        // For database connection errors or other technical errors, return generic message
        throw new Error('Internal Server Error');
      }
    },

    register: async (_: unknown, args: RegisterArgs) => {
      try {
        const { email, password, firstName, lastName } = args.input;
        const result = await AuthService.register(email, password, firstName, lastName);
        return result;
      } catch (error) {
        // Check if it's a user-friendly error
        if (error instanceof Error && (
          error.message.includes('User with this email already exists') ||
          error.message.includes('Invalid credentials') ||
          error.message.includes('User not found') ||
          error.message.includes('Unauthorized')
        )) {
          throw new Error(error.message);
        }
        // For database connection errors or other technical errors, return generic message
        throw new Error('Internal Server Error');
      }
    },

    logout: async () => {
      // In a real implementation, you might want to blacklist the token
      return true;
    },

    createUser: async (_: unknown, args: CreateUserArgs, context: Context) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new Error('Unauthorized');
      }

      const { email, password, firstName, lastName, role = 'USER', isActive = true } = args.input;

      await connectToDatabase();
      const existingUser = await User.findOne({ email }).lean();

      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      const hashedPassword = await AuthService.hashPassword(password);
      const created = await User.create({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role,
        isActive,
      });
      const user = {
        id: created._id.toString(),
        email: created.email,
        firstName: created.firstName,
        lastName: created.lastName,
        role: created.role,
        isActive: created.isActive,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      } as any;

      return user;
    },

    updateUser: async (_: unknown, args: UpdateUserArgs, context: Context) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new Error('Unauthorized');
      }

      const { id, ...updateData } = args.input;
      const userId = id;

      await connectToDatabase();
      const existingUser = await User.findById(userId).lean();

      if (!existingUser) {
        throw new Error('User not found');
      }

      // Prevent admin from updating their own role or status
      if (userId === context.user.id) {
        if (updateData.role !== undefined || updateData.isActive !== undefined) {
          throw new Error('Cannot modify your own role or status');
        }
      }

      // Check if email is being changed and if it's already taken
      if (updateData.email && updateData.email !== existingUser.email) {
        const emailExists = await User.findOne({ email: updateData.email }).lean();

        if (emailExists) {
          throw new Error('Email already in use');
        }
      }

      // Prepare update data
      const finalUpdateData: Partial<{
        email: string;
        firstName: string;
        lastName: string;
        password: string;
        role: 'USER' | 'ADMIN';
        isActive: boolean;
      }> = { ...updateData };

      // Hash password if provided
      if (updateData.password) {
        finalUpdateData.password = await AuthService.hashPassword(updateData.password);
      }

      const updated = await User.findByIdAndUpdate(userId, finalUpdateData, { new: true }).lean();
      if (!updated) throw new Error('User not found');
      const user = {
        id: updated._id.toString(),
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        role: updated.role,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      } as any;

      return user;
    },

    deleteUser: async (_: unknown, args: DeleteUserArgs, context: Context) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new Error('Unauthorized');
      }

      const userId = args.id;

      await connectToDatabase();
      const existingUser = await User.findById(userId).lean();

      if (!existingUser) {
        throw new Error('User not found');
      }

      // Prevent admin from deleting themselves
      if (userId === context.user.id) {
        throw new Error('Cannot delete your own account');
      }

      await User.findByIdAndDelete(userId);

      return true;
    },
  },
};
