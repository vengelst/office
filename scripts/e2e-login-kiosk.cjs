const http = require('http');
const { PrismaClient } = require('@prisma/client');
const jwt = require('/app/node_modules/.pnpm/jsonwebtoken@9.0.3/node_modules/jsonwebtoken');
const { randomUUID } = require('crypto');
const prisma = new PrismaClient();

function req(method, path, token, body) {
  const data = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const r = http.request(
      {
        hostname: '127.0.0.1',
        port: 3801,
        path,
        method,
        headers: {
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => resolve({ status: res.statusCode, body: b.slice(0, 220) }));
      },
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  let r = await req('POST', '/api/auth/login', null, {
    email: 'admin@office.local',
    password: 'admin123',
  });
  const hasToken = /accessToken|"token"/.test(r.body);
  console.log('LOGIN', r.status, hasToken ? 'token-ok' : r.body);

  const user = await prisma.user.findFirst({
    where: { email: 'admin@office.local' },
    select: { id: true, roles: { select: { role: { select: { code: true } } } } },
  });
  const roles = user.roles.map((x) => x.role.code);
  const token = jwt.sign(
    { sub: user.id, type: 'user', roles },
    process.env.JWT_SECRET,
    { expiresIn: '10m', jwtid: randomUUID() },
  );
  await prisma.session.create({
    data: { userId: user.id, token, expiresAt: new Date(Date.now() + 600000) },
  });

  for (const p of [
    '/api/kiosk-settings',
    '/api/kiosk-settings/gps',
    '/api/kiosk-settings/pin',
    '/api/kiosk-settings/overtime',
    '/api/kiosk-settings/overtime-alert',
  ]) {
    r = await req('GET', p, token);
    console.log(r.status, 'GET', p);
  }

  // invoice UI-critical endpoints already covered; check invoice RE detail fields
  r = await req('GET', '/api/invoices?limit=10', token);
  console.log('INVOICES_LIST', r.status, r.body.slice(0, 180));

  await prisma.session.deleteMany({ where: { token } });
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(1);
});
