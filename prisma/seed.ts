import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const username = process.env.SEED_OWNER_USERNAME ?? 'owner';
  const password = process.env.SEED_OWNER_PASSWORD ?? 'Owner@123';

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`Tài khoản owner "${username}" đã tồn tại — bỏ qua seed.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      username,
      passwordHash,
      fullName: 'Chủ cửa hàng',
      role: Role.OWNER,
    },
  });
  console.log(`Đã tạo owner: ${username} / ${password} (đổi mật khẩu sau khi đăng nhập).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
