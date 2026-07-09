import { PrismaClient } from '../src/generated/prisma-client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demonstração',
      slug: 'demo',
      status: 'active',
    },
  });

  const role = await prisma.role.upsert({
    where: {
      tenantId_name: { tenantId: tenant.id, name: 'admin' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'admin',
      permissionsJson: { all: true },
    },
  });

  const passwordHash = await bcrypt.hash('admin123', 10);
  const user = await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: 'admin@demo.local' },
    },
    update: { passwordHash },
    create: {
      tenantId: tenant.id,
      name: 'Administrador',
      email: 'admin@demo.local',
      passwordHash,
      status: 'active',
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: user.id, roleId: role.id },
    },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  const viewerRole = await prisma.role.upsert({
    where: {
      tenantId_name: { tenantId: tenant.id, name: 'viewer' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'viewer',
      permissionsJson: {
        permissions: [
          'devices.read',
          'sites.read',
          'assets.read',
          'playlists.read',
          'groups.read',
          'scheduling.read',
          'monitoring.read',
        ],
      },
    },
  });

  const viewerHash = await bcrypt.hash('viewer123', 10);
  const viewerUser = await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: 'viewer@demo.local' },
    },
    update: { passwordHash: viewerHash },
    create: {
      tenantId: tenant.id,
      name: 'Somente leitura',
      email: 'viewer@demo.local',
      passwordHash: viewerHash,
      status: 'active',
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: viewerUser.id, roleId: viewerRole.id },
    },
    update: {},
    create: { userId: viewerUser.id, roleId: viewerRole.id },
  });

  const existingSite = await prisma.site.findFirst({
    where: { tenantId: tenant.id, code: 'HQ' },
  });
  if (!existingSite) {
    await prisma.site.create({
      data: {
        tenantId: tenant.id,
        name: 'Matriz',
        code: 'HQ',
        timezone: 'America/Sao_Paulo',
      },
    });
  }

  console.log(
    'Seed OK — tenant demo; admin@demo.local / admin123; viewer@demo.local / viewer123 (somente leitura)'
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
