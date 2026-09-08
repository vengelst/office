const { PrismaClient } = require('@prisma/client');
const jwt = require('/app/node_modules/.pnpm/jsonwebtoken@9.0.3/node_modules/jsonwebtoken');
const http = require('http');
const { randomUUID } = require('crypto');
const prisma = new PrismaClient();

function req(method, path, token) {
  return new Promise((resolve, reject) => {
    const r = http.request(
      {
        hostname: '127.0.0.1',
        port: 3801,
        path,
        method,
        headers: { Authorization: 'Bearer ' + token },
      },
      (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => resolve({ status: res.statusCode, body: b.slice(0, 200) }));
      },
    );
    r.on('error', reject);
    r.end();
  });
}

(async () => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      email: true,
      displayName: true,
      roles: { select: { role: { select: { code: true } } } },
    },
  });
  console.log('USERS', JSON.stringify(users));

  const user = await prisma.user.findFirst({
    where: { isActive: true, roles: { some: { role: { code: 'SUPERADMIN' } } } },
    select: {
      id: true,
      roles: { select: { role: { select: { code: true } } } },
    },
  });
  const roles = user.roles.map((x) => x.role.code);
  const token = jwt.sign(
    { sub: user.id, type: 'user', roles },
    process.env.JWT_SECRET,
    { expiresIn: '10m', jwtid: randomUUID() },
  );
  await prisma.session.create({
    data: { userId: user.id, token, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });

  const paths = [
    '/api/time-entries',
    '/api/time-entries/live',
    '/api/time-entries/today',
    '/api/timesheets',
    '/api/timesheets?limit=5',
    '/api/settings/email',
    '/api/settings/storage',
    '/api/settings/ai',
    '/api/company',
    '/api/dashboard',
    '/api/users',
    '/api/vehicles',
    '/api/equipment',
    '/api/teams',
    '/api/todos',
    '/api/documents?limit=5',
    '/api/kiosk-settings',
    '/api/kiosk-settings/overtime-alert',
  ];
  for (const path of paths) {
    const r = await req('GET', path, token);
    console.log(r.status, path, r.body.replace(/\n/g, ' ').slice(0, 120));
  }

  await prisma.session.deleteMany({ where: { token } });
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(1);
});
