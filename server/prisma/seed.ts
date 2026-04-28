import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // Create categories
  const electronics = await prisma.category.create({
    data: {
      name: 'Electronics',
      slug: 'electronics',
    },
  });

  const clothing = await prisma.category.create({
    data: {
      name: 'Clothing',
      slug: 'clothing',
    },
  });

  const books = await prisma.category.create({
    data: {
      name: 'Books',
      slug: 'books',
    },
  });

  const home = await prisma.category.create({
    data: {
      name: 'Home & Garden',
      slug: 'home-garden',
    },
  });

  const sports = await prisma.category.create({
    data: {
      name: 'Sports & Outdoors',
      slug: 'sports-outdoors',
    },
  });

  console.log('✅ Created categories');

  // Create products
  const products = await Promise.all([
    // Electronics
    prisma.product.create({
      data: {
        name: 'Wireless Headphones',
        description: 'High-quality wireless headphones with noise cancellation',
        price: 129.99,
        imageUrl: 'https://via.placeholder.com/300x300?text=Wireless+Headphones',
        inventoryCount: 45,
        categoryId: electronics.id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'USB-C Hub',
        description: 'Multi-port USB-C hub for MacBook and USB-C devices',
        price: 49.99,
        imageUrl: 'https://via.placeholder.com/300x300?text=USB-C+Hub',
        inventoryCount: 120,
        categoryId: electronics.id,
      },
    }),
    prisma.product.create({
      data: {
        name: '27" 4K Monitor',
        description: 'Ultra-high definition 27-inch display',
        price: 399.99,
        imageUrl: 'https://via.placeholder.com/300x300?text=4K+Monitor',
        inventoryCount: 25,
        categoryId: electronics.id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Mechanical Keyboard',
        description: 'RGB mechanical keyboard with Cherry MX switches',
        price: 159.99,
        imageUrl: 'https://via.placeholder.com/300x300?text=Mechanical+Keyboard',
        inventoryCount: 60,
        categoryId: electronics.id,
      },
    }),
    // Clothing
    prisma.product.create({
      data: {
        name: 'Cotton T-Shirt',
        description: 'Premium 100% cotton t-shirt in multiple colors',
        price: 24.99,
        imageUrl: 'https://via.placeholder.com/300x300?text=Cotton+T-Shirt',
        inventoryCount: 200,
        categoryId: clothing.id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Denim Jeans',
        description: 'Classic blue denim jeans',
        price: 69.99,
        imageUrl: 'https://via.placeholder.com/300x300?text=Denim+Jeans',
        inventoryCount: 150,
        categoryId: clothing.id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Winter Jacket',
        description: 'Warm insulated winter jacket',
        price: 199.99,
        imageUrl: 'https://via.placeholder.com/300x300?text=Winter+Jacket',
        inventoryCount: 80,
        categoryId: clothing.id,
      },
    }),
    // Books
    prisma.product.create({
      data: {
        name: 'The Great Gatsby',
        description: 'F. Scott Fitzgerald classic novel',
        price: 14.99,
        imageUrl: 'https://via.placeholder.com/300x300?text=The+Great+Gatsby',
        inventoryCount: 500,
        categoryId: books.id,
      },
    }),
    prisma.product.create({
      data: {
        name: '1984',
        description: 'George Orwell dystopian novel',
        price: 16.99,
        imageUrl: 'https://via.placeholder.com/300x300?text=1984',
        inventoryCount: 400,
        categoryId: books.id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'To Kill a Mockingbird',
        description: 'Harper Lee classic American novel',
        price: 15.99,
        imageUrl: 'https://via.placeholder.com/300x300?text=To+Kill+a+Mockingbird',
        inventoryCount: 350,
        categoryId: books.id,
      },
    }),
    // Home & Garden
    prisma.product.create({
      data: {
        name: 'LED Desk Lamp',
        description: 'Modern LED desk lamp with touch control',
        price: 39.99,
        imageUrl: 'https://via.placeholder.com/300x300?text=LED+Desk+Lamp',
        inventoryCount: 90,
        categoryId: home.id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Plant Pot Set',
        description: 'Set of 5 ceramic plant pots',
        price: 34.99,
        imageUrl: 'https://via.placeholder.com/300x300?text=Plant+Pot+Set',
        inventoryCount: 110,
        categoryId: home.id,
      },
    }),
    // Sports & Outdoors
    prisma.product.create({
      data: {
        name: 'Yoga Mat',
        description: 'Non-slip yoga mat, 6mm thickness',
        price: 29.99,
        imageUrl: 'https://via.placeholder.com/300x300?text=Yoga+Mat',
        inventoryCount: 180,
        categoryId: sports.id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Water Bottle',
        description: 'Stainless steel insulated water bottle',
        price: 34.99,
        imageUrl: 'https://via.placeholder.com/300x300?text=Water+Bottle',
        inventoryCount: 250,
        categoryId: sports.id,
      },
    }),
  ]);

  console.log('✅ Created 15 products');

  // Create users
  const adminPassword = await bcrypt.hash('admin123', 10);
  const userPassword = await bcrypt.hash('user123', 10);

  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@example.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
    },
  });

  const regularUser = await prisma.user.create({
    data: {
      name: 'John Doe',
      email: 'user@example.com',
      passwordHash: userPassword,
      role: 'USER',
    },
  });

  console.log('✅ Created 2 users');
  console.log(
    `\n👤 Test Credentials:\n   Admin: admin@example.com / admin123\n   User: user@example.com / user123\n`
  );
  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
