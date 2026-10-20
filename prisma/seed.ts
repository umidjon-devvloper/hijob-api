import { PrismaClient, ProductStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding N24:31 dev database...');

  /* ─── Categories ─── */
  await prisma.category.createMany({
    data: [
      { id: 'scarves', nameRu: 'Платки', nameUz: "Ro'mollar", nameEn: 'Scarves', order: 1 },
      { id: 'dresses', nameRu: 'Платья', nameUz: "Ko'ylaklar", nameEn: 'Dresses', order: 2 },
      { id: 'bags', nameRu: 'Сумки', nameUz: 'Sumkalar', nameEn: 'Bags', order: 3 },
      { id: 'accessories', nameRu: 'Аксессуары', nameUz: 'Aksessuarlar', nameEn: 'Accessories', order: 4 },
    ],
    skipDuplicates: true,
  });
  console.log('✓ Categories');

  /* ─── Test buyer ─── */
  const buyer = await prisma.user.upsert({
    where: { username: 'diyor' },
    create: {
      username: 'diyor',
      phone: '+998901234567',
      fullName: 'Diyor Test',
      role: 'buyer',
      language: 'ru',
      passwordHash: await bcrypt.hash('test1234', 10),
      phoneVerified: true,
    },
    update: {},
  });
  console.log('✓ Test buyer @diyor / test1234');

  /* ─── Admin ─── */
  await prisma.user.upsert({
    where: { username: 'admin' },
    create: {
      username: 'admin',
      phone: '+998900099999',
      fullName: 'N24:31 Admin',
      role: 'admin',
      language: 'ru',
      passwordHash: await bcrypt.hash('admin1234', 10),
      phoneVerified: true,
    },
    update: { role: 'admin' },
  });
  console.log('✓ Admin @admin / admin1234');

  /* ─── Test sellers ─── */
  const sellersData = [
    { username: 'noor', brand: 'Noor', desc: 'Классические платки премиум-класса' },
    { username: 'hijabhouse', brand: 'Hijab House', desc: 'Модные хиджабы для современных женщин' },
    { username: 'sabr', brand: 'Sabr', desc: 'Платки и одежда ручной работы' },
    { username: 'amani', brand: 'Amani', desc: 'Строгий и элегантный стиль' },
    { username: 'zahra', brand: 'Zahra', desc: 'Природные ткани и мягкие тона' },
  ];

  const sellers = [];
  for (const s of sellersData) {
    const user = await prisma.user.upsert({
      where: { username: s.username },
      create: {
        username: s.username,
        phone: `+998900000${sellersData.indexOf(s).toString().padStart(3, '0')}`,
        fullName: s.brand,
        role: 'seller',
        language: 'ru',
        passwordHash: await bcrypt.hash('seller1234', 10),
        phoneVerified: true,
      },
      update: {},
    });

    const seller = await prisma.seller.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        brandName: s.brand,
        description: s.desc,
        city: 'Ташкент',
        rating: 4.8,
        reviewsCount: 1200,
        verified: true,
      },
      update: {},
    });
    sellers.push(seller);
  }
  console.log(`✓ ${sellers.length} sellers`);

  /* ─── Sample scarves ─── */
  const scarves = [
    { title: 'Платок «Нежность»', color: 'Бежевый', hex: '#D4C3A0', price: 18 },
    { title: 'Платок «Олива»', color: 'Зелёный', hex: '#7A8A5B', price: 21 },
    { title: 'Платок «Восток»', color: 'Разноцветный', hex: '#8A8D5B', price: 25 },
    { title: 'Платок «Классика»', color: 'Чёрный', hex: '#1A1A1A', price: 20 },
    { title: 'Платок «Розовый сад»', color: 'Розовый', hex: '#E8B0B0', price: 22 },
    { title: 'Платок «Гармония»', color: 'Разноцветный', hex: '#B097C6', price: 28 },
  ];

  for (let i = 0; i < scarves.length; i++) {
    const scarf = scarves[i]!;
    const seller = sellers[i % sellers.length]!;
    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId: 'scarves',
        titleRu: scarf.title,
        basePriceUsd: scarf.price,
        coverUrl: `https://picsum.photos/seed/scarf-${i}/600/800`,
        gallery: [
          `https://picsum.photos/seed/scarf-${i}-a/600/800`,
          `https://picsum.photos/seed/scarf-${i}-b/600/800`,
        ],
        attributes: { scarfModel: 'classical', fabric: 'chiffon' },
        filters: { color: [scarf.color], size: ['110x110'] },
        status: ProductStatus.published,
        popularityScore: 100 - i,
        publishedAt: new Date(),
        variants: {
          create: [
            {
              color: scarf.color,
              colorHex: scarf.hex,
              size: '110x110',
              priceUsd: scarf.price,
              stock: 25,
              sku: `SCARF-${i}-110`,
              images: [`https://picsum.photos/seed/scarf-${i}-1/800/1000`],
            },
          ],
        },
      },
    });
    console.log(`  → ${product.titleRu}`);
  }

  /* ─── Sample dresses ─── */
  const dresses = [
    { title: 'Платье «Элегантность»', color: 'Зелёный', hex: '#7A8A5B', price: 45 },
    { title: 'Платье «Нежность»', color: 'Бежевый', hex: '#D4C3A0', price: 52 },
    { title: 'Платье «Классика»', color: 'Чёрный', hex: '#1A1A1A', price: 48 },
    { title: 'Платье «Айша»', color: 'Оливковый', hex: '#8A8D5B', price: 45 },
  ];

  for (let i = 0; i < dresses.length; i++) {
    const dress = dresses[i]!;
    const seller = sellers[i % sellers.length]!;
    await prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId: 'dresses',
        titleRu: dress.title,
        basePriceUsd: dress.price,
        coverUrl: `https://picsum.photos/seed/dress-${i}/600/900`,
        gallery: [`https://picsum.photos/seed/dress-${i}-a/600/900`],
        attributes: { dressCut: 'classical', length: 'maxi', sleeve: 'long' },
        filters: { color: [dress.color], size: ['S', 'M', 'L', 'XL'] },
        status: ProductStatus.published,
        popularityScore: 80 - i,
        publishedAt: new Date(),
        variants: {
          create: ['S', 'M', 'L', 'XL'].map((size) => ({
            color: dress.color,
            colorHex: dress.hex,
            size,
            priceUsd: dress.price,
            stock: 10,
            sku: `DRESS-${i}-${size}`,
            images: [`https://picsum.photos/seed/dress-${i}-${size}/800/1200`],
          })),
        },
      },
    });
  }

  console.log('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
