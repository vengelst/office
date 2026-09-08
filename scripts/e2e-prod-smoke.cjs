const { PrismaClient } = require('@prisma/client');
const jwt = require('/app/node_modules/.pnpm/jsonwebtoken@9.0.3/node_modules/jsonwebtoken');
const http = require('http');
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
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => {
          let parsed = b;
          try {
            parsed = JSON.parse(b);
          } catch {}
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const results = [];
  const ok = (name, cond, detail) => {
    results.push({ name, ok: !!cond, detail: detail == null ? '' : String(detail).slice(0, 280) });
  };

  const stats = {
    users: await prisma.user.count({ where: { isActive: true } }),
    customers: await prisma.customer.count({ where: { deletedAt: null } }),
    projects: await prisma.project.count({ where: { deletedAt: null } }),
    products: await prisma.invoiceProduct.count(),
    invoices: await prisma.invoice.groupBy({ by: ['status', 'invoiceType'], _count: true }),
    series: await prisma.invoiceNumberSeries.findMany({
      select: { code: true, prefix: true, nextNumber: true },
    }),
  };
  ok('DB reachable', stats.users > 0 && stats.customers > 0, JSON.stringify(stats));

  const user = await prisma.user.findFirst({
    where: { isActive: true, roles: { some: { role: { code: 'SUPERADMIN' } } } },
    select: {
      id: true,
      email: true,
      roles: { select: { role: { select: { code: true } } } },
    },
  });
  const roles = user.roles.map((x) => x.role.code);
  const token = jwt.sign(
    { sub: user.id, type: 'user', roles },
    process.env.JWT_SECRET,
    { expiresIn: '15m', jwtid: randomUUID() },
  );
  await prisma.session.create({
    data: { userId: user.id, token, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
  });

  const checks = [
    ['GET /api/customers', 'GET', '/api/customers?limit=5'],
    ['GET /api/projects', 'GET', '/api/projects?limit=5'],
    ['GET /api/invoices', 'GET', '/api/invoices?limit=5'],
    ['GET /api/invoices/stats', 'GET', '/api/invoices/stats'],
    ['GET /api/invoices/skonto', 'GET', '/api/invoices/skonto'],
    ['GET /api/invoice-products', 'GET', '/api/invoice-products'],
    ['GET /api/settings/billing', 'GET', '/api/settings/billing'],
    ['GET /api/time-entries', 'GET', '/api/time-entries?limit=5'],
    ['GET /api/weekly-timesheets', 'GET', '/api/weekly-timesheets?limit=5'],
    ['GET /api/workers', 'GET', '/api/workers?limit=5'],
    ['GET /api/subcontractors', 'GET', '/api/subcontractors?limit=5'],
    ['GET /api/feature-flags', 'GET', '/api/feature-flags'],
    ['GET /api/app-settings', 'GET', '/api/app-settings'],
  ];

  for (const [name, method, path] of checks) {
    const r = await req(method, path, token);
    ok(name, r.status >= 200 && r.status < 400, r.status + ' ' + JSON.stringify(r.body).slice(0, 120));
  }

  // finalized invoice PDF + detail
  const finalized = await prisma.invoice.findFirst({
    where: { invoiceNumber: { not: null }, invoiceType: 'OUTGOING' },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, invoiceNumber: true, status: true },
  });
  ok('Finalized RE exists', !!finalized, JSON.stringify(finalized));
  if (finalized) {
    let r = await req('GET', '/api/invoices/' + finalized.id, token);
    ok('GET finalized invoice', r.status === 200 && r.body?.invoiceNumber === finalized.invoiceNumber, r.status);
    r = await req('GET', '/api/invoices/' + finalized.id + '/pdf', token);
    ok('PDF bytes', r.status === 200, r.status);
    r = await req('GET', '/api/invoices/' + finalized.id + '/email-attachments', token);
    ok('Email attachments list', r.status === 200, r.status + ' ' + JSON.stringify(r.body).slice(0, 120));
  }

  // immutability: patch finalized should fail
  if (finalized) {
    const r = await req('PATCH', '/api/invoices/' + finalized.id, token, { notes: 'e2e-should-fail' });
    ok('Finalized immutable', r.status >= 400, r.status + ' ' + JSON.stringify(r.body).slice(0, 180));
  }

  const failed = results.filter((x) => !x.ok);
  console.log(JSON.stringify({ passed: results.filter((x) => x.ok).length, failed: failed.length, results }, null, 2));
  await prisma.session.deleteMany({ where: { token } });
  await prisma.$disconnect();
  process.exit(failed.length ? 2 : 0);
})().catch(async (e) => {
  console.error(String(e && e.stack ? e.stack : e));
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(1);
});
