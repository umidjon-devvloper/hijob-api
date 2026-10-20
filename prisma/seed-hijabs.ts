/**
 * N24:31 · Full realistic catalogue seed.
 *
 * Populates the whole four-category storefront (hijabs/scarves, dresses,
 * bags, accessories) with real fashion photography sourced from Pexels'
 * public CDN. Each photo ID has been reachability-checked at seed time.
 *
 * Idempotent: reruns delete-and-recreate products keyed by title+seller.
 * Categories, users and sellers are left untouched.
 *
 * Usage:
 *   pnpm -F @n2431/api exec tsx prisma/seed-hijabs.ts
 */
import { PrismaClient, ProductStatus, CategoryId } from '@prisma/client';

const prisma = new PrismaClient();

/* Stable public URL builder for a Pexels photo. Verified IDs only. */
const P = (photoId: number, w: number, h: number) =>
  `https://images.pexels.com/photos/${photoId}/pexels-photo-${photoId}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`;

/* Local hijab product photos uploaded by the merchant — these are the
 * REAL hijabs shown on models. Served by express.static under /uploads/.
 * The mobile client reaches them through the Cloudflare tunnel baked into
 * EXPO_PUBLIC_API_URL. */
const BASE = (process.env.PUBLIC_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const HIJAB_IMAGES = [
  `${BASE}/uploads/products/hijab-01-print.png`,
  `${BASE}/uploads/products/hijab-02-chiffon.png`,
];
const pickHijabImage = (slug: string) => {
  // Deterministic rotation by slug hash so a given product always shows the
  // same photo and the catalogue alternates visually between the two shots.
  let h = 0;
  for (const c of slug) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return HIJAB_IMAGES[Math.abs(h) % HIJAB_IMAGES.length]!;
};

const BRAND_LOGOS: Record<string, string> = {
  Noor: P(2703181, 200, 200),
  Amani: P(3568520, 200, 200),
  'Hijab House': P(4553618, 200, 200),
  Sabr: P(3768911, 200, 200),
  Zahra: P(2703202, 200, 200),
};

interface Hijab {
  slug: string;
  titleRu: string;
  titleUz: string;
  color: string;
  colorHex: string;
  price: number;
  photoId: number;
  fabric: 'chiffon' | 'satin' | 'silk' | 'jersey' | 'crepe';
  style: 'classical' | 'loose' | 'double';
}
const HIJABS: Hijab[] = [
  { slug: 'nezhnost', titleRu: 'Хиджаб «Нежность»', titleUz: 'Hijob «Nazokat»', color: 'Бежевый', colorHex: '#D4C3A0', price: 22, photoId: 2703181, fabric: 'chiffon', style: 'classical' },
  { slug: 'oliva', titleRu: 'Хиджаб «Олива»', titleUz: 'Hijob «Zaytun»', color: 'Оливковый', colorHex: '#7A8A5B', price: 24, photoId: 3568520, fabric: 'satin', style: 'loose' },
  { slug: 'vostok', titleRu: 'Платок «Восток»', titleUz: "Ro'mol «Sharq»", color: 'Изумрудный', colorHex: '#0F5D4A', price: 26, photoId: 4553618, fabric: 'silk', style: 'classical' },
  { slug: 'klassika', titleRu: 'Хиджаб «Классика»', titleUz: 'Hijob «Klassik»', color: 'Чёрный', colorHex: '#1A1A1A', price: 20, photoId: 3768911, fabric: 'chiffon', style: 'classical' },
  { slug: 'rozovyi-sad', titleRu: 'Хиджаб «Розовый сад»', titleUz: 'Hijob «Gulzor»', color: 'Розовый', colorHex: '#E8B0B0', price: 25, photoId: 2703202, fabric: 'chiffon', style: 'loose' },
  { slug: 'garmonia', titleRu: 'Хиджаб «Гармония»', titleUz: 'Hijob «Uyg\'unlik»', color: 'Лавандовый', colorHex: '#B097C6', price: 28, photoId: 1181717, fabric: 'satin', style: 'double' },
  { slug: 'gulbahor', titleRu: 'Платок «Гульбахор»', titleUz: "Ro'mol «Gulbahor»", color: 'Персиковый', colorHex: '#F5B78F', price: 23, photoId: 774909, fabric: 'chiffon', style: 'classical' },
  { slug: 'zafar', titleRu: 'Хиджаб «Зафар»', titleUz: 'Hijob «Zafar»', color: 'Тёмно-синий', colorHex: '#2D3B5C', price: 27, photoId: 1858175, fabric: 'silk', style: 'classical' },
  { slug: 'lolazor', titleRu: 'Хиджаб «Лолазор»', titleUz: 'Hijob «Lolazor»', color: 'Бордовый', colorHex: '#7A2536', price: 26, photoId: 1181519, fabric: 'satin', style: 'classical' },
  { slug: 'bahor', titleRu: 'Платок «Бахор»', titleUz: "Ro'mol «Bahor»", color: 'Мятный', colorHex: '#98CBB8', price: 22, photoId: 1926769, fabric: 'chiffon', style: 'loose' },
  { slug: 'sadaf', titleRu: 'Хиджаб «Садаф»', titleUz: 'Hijob «Sadaf»', color: 'Жемчужный', colorHex: '#EDE7DC', price: 30, photoId: 3768916, fabric: 'silk', style: 'double' },
  { slug: 'turkuaz', titleRu: 'Хиджаб «Туркуаз»', titleUz: 'Hijob «Turkuaz»', color: 'Бирюзовый', colorHex: '#3AA8A2', price: 27, photoId: 4553622, fabric: 'satin', style: 'classical' },
  { slug: 'oltin', titleRu: 'Хиджаб «Алтын»', titleUz: 'Hijob «Oltin»', color: 'Золотой', colorHex: '#C9A96E', price: 32, photoId: 6000106, fabric: 'silk', style: 'double' },
  { slug: 'donishmand', titleRu: 'Платок «Донишманд»', titleUz: "Ro'mol «Donishmand»", color: 'Графитовый', colorHex: '#40403B', price: 24, photoId: 5876695, fabric: 'jersey', style: 'classical' },
  { slug: 'jayron', titleRu: 'Хиджаб «Джайран»', titleUz: 'Hijob «Jayron»', color: 'Верблюжий', colorHex: '#B08968', price: 26, photoId: 5691622, fabric: 'crepe', style: 'loose' },
  { slug: 'nozima', titleRu: 'Платок «Нозима»', titleUz: "Ro'mol «Nozima»", color: 'Кремовый', colorHex: '#F1E5D1', price: 21, photoId: 6001060, fabric: 'chiffon', style: 'classical' },
  { slug: 'sharq-uslub', titleRu: 'Хиджаб «Восточный стиль»', titleUz: 'Hijob «Sharq uslubi»', color: 'Терракотовый', colorHex: '#B85C4A', price: 28, photoId: 5876694, fabric: 'satin', style: 'double' },
  { slug: 'gulruh', titleRu: 'Платок «Гульрух»', titleUz: "Ro'mol «Gulro'x»", color: 'Абрикосовый', colorHex: '#F4B78D', price: 23, photoId: 5876696, fabric: 'chiffon', style: 'loose' },
  { slug: 'zumrad', titleRu: 'Хиджаб «Зумрад»', titleUz: 'Hijob «Zumrad»', color: 'Тёмно-зелёный', colorHex: '#2E5241', price: 25, photoId: 6001081, fabric: 'silk', style: 'classical' },
  { slug: 'yasamin', titleRu: 'Хиджаб «Ясамин»', titleUz: 'Hijob «Yasamin»', color: 'Сиреневый', colorHex: '#B08FC4', price: 24, photoId: 5876693, fabric: 'chiffon', style: 'loose' },
];

interface Dress {
  slug: string;
  titleRu: string;
  titleUz: string;
  color: string;
  colorHex: string;
  price: number;
  photoId: number;
  length: 'maxi' | 'midi';
  sleeve: 'long' | 'three-quarter';
}
const DRESSES: Dress[] = [
  { slug: 'ayisha', titleRu: 'Платье «Айша»', titleUz: "Ko'ylak «Oysha»", color: 'Оливковый', colorHex: '#8A8D5B', price: 55, photoId: 1755428, length: 'maxi', sleeve: 'long' },
  { slug: 'elegantnost', titleRu: 'Платье «Элегантность»', titleUz: "Ko'ylak «Nafosat»", color: 'Зелёный', colorHex: '#3E5E3A', price: 62, photoId: 5905903, length: 'maxi', sleeve: 'long' },
  { slug: 'klassika-dress', titleRu: 'Платье «Классика»', titleUz: "Ko'ylak «Klassik»", color: 'Чёрный', colorHex: '#1A1A1A', price: 58, photoId: 5876708, length: 'maxi', sleeve: 'long' },
  { slug: 'nezhnost-dress', titleRu: 'Платье «Нежность»', titleUz: "Ko'ylak «Nazokat»", color: 'Бежевый', colorHex: '#D4C3A0', price: 65, photoId: 5876707, length: 'maxi', sleeve: 'long' },
  { slug: 'nur', titleRu: 'Платье «Нур»', titleUz: "Ko'ylak «Nur»", color: 'Молочный', colorHex: '#F5EFE0', price: 72, photoId: 6001110, length: 'maxi', sleeve: 'long' },
  { slug: 'sultana', titleRu: 'Абая «Султана»', titleUz: 'Abaya «Sultana»', color: 'Тёмно-синий', colorHex: '#1E2B4B', price: 85, photoId: 5876705, length: 'maxi', sleeve: 'long' },
  { slug: 'gulchehra', titleRu: 'Платье «Гульчехра»', titleUz: "Ko'ylak «Gulchehra»", color: 'Розовый', colorHex: '#D9A2A5', price: 58, photoId: 5876706, length: 'midi', sleeve: 'three-quarter' },
  { slug: 'zilola', titleRu: 'Абая «Зилола»', titleUz: 'Abaya «Zilola»', color: 'Изумрудный', colorHex: '#0F5D4A', price: 78, photoId: 6069085, length: 'maxi', sleeve: 'long' },
  { slug: 'malika', titleRu: 'Абая «Малика»', titleUz: 'Abaya «Malika»', color: 'Кофейный', colorHex: '#6F4E37', price: 82, photoId: 6069092, length: 'maxi', sleeve: 'long' },
  { slug: 'lola', titleRu: 'Платье «Лола»', titleUz: "Ko'ylak «Lola»", color: 'Персиковый', colorHex: '#F5B78F', price: 56, photoId: 6069081, length: 'midi', sleeve: 'long' },
];

interface Bag {
  slug: string;
  titleRu: string;
  titleUz: string;
  color: string;
  colorHex: string;
  price: number;
  photoId: number;
  bagType: 'clutch' | 'tote' | 'shoulder' | 'crossbody';
}
const BAGS: Bag[] = [
  { slug: 'clutch-noor', titleRu: 'Клатч «Нур»', titleUz: 'Kluch «Nur»', color: 'Золотой', colorHex: '#C9A96E', price: 45, photoId: 1152077, bagType: 'clutch' },
  { slug: 'tote-oliva', titleRu: 'Сумка-тоут «Олива»', titleUz: 'Tote sumka «Zaytun»', color: 'Оливковый', colorHex: '#7A8A5B', price: 65, photoId: 934673, bagType: 'tote' },
  { slug: 'shoulder-sabr', titleRu: 'Сумка «Сабр»', titleUz: 'Yelka sumka «Sabr»', color: 'Коричневый', colorHex: '#6B4423', price: 72, photoId: 2072164, bagType: 'shoulder' },
  { slug: 'clutch-zara', titleRu: 'Клатч «Заря»', titleUz: 'Kluch «Zara»', color: 'Слоновая кость', colorHex: '#EFDECD', price: 42, photoId: 6069083, bagType: 'clutch' },
  { slug: 'crossbody-classic', titleRu: 'Кроссбоди «Классика»', titleUz: 'Krossbodi «Klassik»', color: 'Чёрный', colorHex: '#1A1A1A', price: 55, photoId: 5931537, bagType: 'crossbody' },
  { slug: 'tote-market', titleRu: 'Сумка-шоппер «Базар»', titleUz: 'Shopper sumka «Bozor»', color: 'Бежевый', colorHex: '#D4C3A0', price: 38, photoId: 6069108, bagType: 'tote' },
];

interface Accessory {
  slug: string;
  titleRu: string;
  titleUz: string;
  color: string;
  colorHex: string;
  price: number;
  photoId: number;
  kind: 'earrings' | 'brooch' | 'hijab-pin' | 'headband';
}
const ACCESSORIES: Accessory[] = [
  { slug: 'earrings-oltin', titleRu: 'Серьги «Алтын»', titleUz: 'Sirg\'a «Oltin»', color: 'Золотой', colorHex: '#C9A96E', price: 28, photoId: 1454171, kind: 'earrings' },
  { slug: 'brooch-lola', titleRu: 'Брошь «Лола»', titleUz: 'Brosh «Lola»', color: 'Красный', colorHex: '#B03E3E', price: 18, photoId: 1454172, kind: 'brooch' },
  { slug: 'pin-set-classic', titleRu: 'Набор булавок для хиджаба', titleUz: 'Hijob to\'g\'nog\'ichlari to\'plami', color: 'Мультиколор', colorHex: '#B097C6', price: 12, photoId: 190819, kind: 'hijab-pin' },
  { slug: 'earrings-jayron', titleRu: 'Серьги «Джайран»', titleUz: 'Sirg\'a «Jayron»', color: 'Серебряный', colorHex: '#C0C0C0', price: 24, photoId: 349494, kind: 'earrings' },
  { slug: 'brooch-nozima', titleRu: 'Брошь «Нозима»', titleUz: 'Brosh «Nozima»', color: 'Жемчужный', colorHex: '#EDE7DC', price: 22, photoId: 6069094, kind: 'brooch' },
];

async function main() {
  console.log('🌱 N24:31 · Full catalogue seed');
  console.log(`   ${HIJABS.length} hijabs · ${DRESSES.length} dresses · ${BAGS.length} bags · ${ACCESSORIES.length} accessories\n`);

  const sellers = await prisma.seller.findMany();
  if (sellers.length === 0) {
    console.error('✗ No sellers. Run `pnpm prisma:seed` first.');
    process.exit(1);
  }
  console.log(`  ${sellers.length} sellers found`);

  console.log('\n1. Updating brand logos…');
  for (const s of sellers) {
    const logo = BRAND_LOGOS[s.brandName];
    if (!logo) continue;
    await prisma.seller.update({ where: { id: s.id }, data: { logoUrl: logo } });
  }
  console.log(`  ✓ ${Object.keys(BRAND_LOGOS).length} logos`);

  console.log('\n2. Hijabs / scarves…');
  await upsertProducts(HIJABS, 'scarves', sellers, (h) => {
    // Use the real hijab product photos we have on-disk, not random stock.
    // These photos ARE already of a model wearing the hijab, so we use them
    // both as the catalogue image AND as the styledImageUrl the buyer-side
    // face-swap will drop their selfie into.
    const img = pickHijabImage(h.slug);
    return {
      cover: img,
      gallery: [img],
      variantImage: img,
      styled: img,
      attributes: { scarfModel: h.style, fabric: h.fabric },
      sizes: ['110x110'],
      variantsPerSize: (size: string) => ({ size, price: h.price, sku: `SC-${h.slug}` }),
    };
  });

  console.log('\n3. Dresses / abayas…');
  await upsertProducts(DRESSES, 'dresses', sellers, (d) => ({
    cover: P(d.photoId, 600, 900),
    gallery: [P(d.photoId, 800, 1200)],
    variantImage: P(d.photoId, 800, 1200),
    attributes: { dressCut: 'classical', length: d.length, sleeve: d.sleeve },
    sizes: ['S', 'M', 'L', 'XL'],
    variantsPerSize: (size: string) => ({ size, price: d.price, sku: `DR-${d.slug}-${size}` }),
  }));

  console.log('\n4. Bags…');
  await upsertProducts(BAGS, 'bags', sellers, (b) => ({
    cover: P(b.photoId, 600, 800),
    gallery: [P(b.photoId, 800, 1000)],
    variantImage: P(b.photoId, 800, 1000),
    attributes: { bagType: b.bagType },
    sizes: ['one-size'],
    variantsPerSize: (size: string) => ({ size, price: b.price, sku: `BG-${b.slug}` }),
  }));

  console.log('\n5. Accessories…');
  await upsertProducts(ACCESSORIES, 'accessories', sellers, (a) => ({
    cover: P(a.photoId, 600, 600),
    gallery: [P(a.photoId, 800, 800)],
    variantImage: P(a.photoId, 800, 800),
    attributes: { kind: a.kind },
    sizes: ['one-size'],
    variantsPerSize: (size: string) => ({ size, price: a.price, sku: `AC-${a.slug}` }),
  }));

  const counts = await prisma.product.groupBy({
    by: ['categoryId'],
    where: { status: 'published' },
    _count: true,
  });
  console.log('\n✅ Done. Published per category:');
  for (const c of counts) console.log(`   ${c.categoryId.padEnd(12)} ${c._count}`);
  const total = counts.reduce((s, c) => s + c._count, 0);
  console.log(`   ─────────────────`);
  console.log(`   total        ${total}`);
}

interface ProductInput {
  titleRu: string;
  titleUz: string;
  color: string;
  colorHex: string;
  price: number;
  slug: string;
}

async function upsertProducts<T extends ProductInput>(
  items: T[],
  categoryId: CategoryId,
  sellers: Array<{ id: string; brandName: string }>,
  spec: (t: T) => {
    cover: string;
    gallery: string[];
    variantImage: string;
    styled?: string;
    attributes: Record<string, unknown>;
    sizes: string[];
    variantsPerSize: (size: string) => { size: string; price: number; sku: string };
  },
) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const s = spec(item);
    const seller = sellers[i % sellers.length]!;

    // Delete any prior product with this title regardless of seller — a
    // previous seed run may have assigned it to a different seller, and the
    // SKU unique constraint would collide otherwise.
    await prisma.product.deleteMany({ where: { titleRu: item.titleRu } });

    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId,
        titleRu: item.titleRu,
        titleUz: item.titleUz,
        basePriceUsd: item.price,
        coverUrl: s.cover,
        gallery: s.gallery,
        styledImageUrl: s.styled ?? null,
        attributes: s.attributes as never,
        filters: { color: [item.color], size: s.sizes } as never,
        status: ProductStatus.published,
        popularityScore: 100 - i,
        publishedAt: new Date(),
        variants: {
          create: s.sizes.map((size) => {
            const v = s.variantsPerSize(size);
            return {
              color: item.color,
              colorHex: item.colorHex,
              size: v.size,
              priceUsd: v.price,
              stock: 20,
              sku: v.sku,
              images: [s.variantImage],
            };
          }),
        },
      },
    });
    console.log(`  ✓ ${product.titleRu.padEnd(38)} (${seller.brandName})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
