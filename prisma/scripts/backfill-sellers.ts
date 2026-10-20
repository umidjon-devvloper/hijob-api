import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const sellerUsers = await p.user.findMany({
    where: { role: 'seller', seller: null },
    select: { id: true, username: true, fullName: true },
  });
  console.log('seller-role users without Seller row:', sellerUsers.length);
  for (const u of sellerUsers) {
    const name = (u.fullName || u.username || "Yangi do'kon").slice(0, 120);
    await p.seller.create({
      data: {
        userId: u.id,
        brandName: name,
        verified: false,
      },
    });
    console.log(' • provisioned seller for', u.username, '→', name);
  }
  await p.$disconnect();
})();
