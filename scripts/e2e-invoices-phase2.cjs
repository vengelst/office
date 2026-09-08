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
    results.push({ name, ok: !!cond, detail: detail == null ? '' : String(detail).slice(0, 300) });
  };

  const user = await prisma.user.findFirst({
    where: { isActive: true, roles: { some: { role: { code: 'SUPERADMIN' } } } },
    select: {
      id: true,
      email: true,
      roles: { select: { role: { select: { code: true } } } },
    },
  });
  if (!user) throw new Error('no superadmin');
  const roles = user.roles.map((x) => x.role.code);
  const token = jwt.sign(
    { sub: user.id, type: 'user', roles },
    process.env.JWT_SECRET,
    { expiresIn: '20m', jwtid: randomUUID() },
  );
  await prisma.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 20 * 60 * 1000),
    },
  });

  let r = await req('GET', '/api/settings/billing', token);
  ok('GET billing settings', r.status === 200, r.status);
  ok(
    'RE series configured',
    r.body?.series?.re?.prefix === 'RE' && r.body?.series?.re?.nextNumber >= 40000113,
    JSON.stringify(r.body?.series?.re),
  );

  const startNext = r.body?.series?.re?.nextNumber;
  const expectedNumber = 'RE-' + startNext;

  r = await req('POST', '/api/invoice-products', token, {
    name: 'E2E Testleistung',
    unit: 'Std',
    defaultUnitPrice: 85.5,
    active: true,
  });
  ok('Create product', r.status < 300 && !!r.body?.id, r.status + ' ' + JSON.stringify(r.body));
  const productId = r.body?.id;

  const customer = await prisma.customer.findFirst({
    where: { deletedAt: null },
    select: { id: true, companyName: true, vatId: true },
  });
  ok('Customer exists', !!customer, customer?.companyName);
  const project = await prisma.project.findFirst({
    where: { customerId: customer.id, deletedAt: null },
    select: { id: true, title: true, projectNumber: true },
  });
  ok('Project for customer', !!project, project?.projectNumber);

  if (productId && customer) {
    r = await req(
      'PUT',
      '/api/customers/' + customer.id + '/product-prices',
      token,
      { productId, unitPrice: 99.0 },
    );
    ok('Upsert customer price', r.status < 300, r.status + ' ' + JSON.stringify(r.body));
  }

  r = await req('POST', '/api/invoices', token, {
    invoiceType: 'OUTGOING',
    customerId: customer.id,
    projectId: project?.id,
    taxRate: 19,
    performanceCountryCode: 'DE',
    taxKind: 'STANDARD',
    periodFrom: '2026-09-01T00:00:00.000Z',
    periodTo: '2026-09-06T00:00:00.000Z',
    paymentTermDays: 14,
  });
  ok('Create draft invoice', r.status < 300 && !!r.body?.id, r.status + ' ' + JSON.stringify(r.body));
  const invoiceId = r.body?.id;
  ok(
    'Draft has no invoiceNumber',
    !!invoiceId && (r.body.invoiceNumber == null || r.body.invoiceNumber === ''),
    r.body?.invoiceNumber,
  );

  if (invoiceId && productId) {
    r = await req('POST', '/api/invoices/' + invoiceId + '/lines', token, {
      lineType: 'CUSTOM',
      description: 'E2E Position',
      quantity: 10,
      unit: 'Std',
      unitPrice: 99,
      productId,
      discountPercent: 10,
      position: 1,
    });
    ok('Add line with discount', r.status < 300, r.status + ' ' + JSON.stringify(r.body));
  }

  r = await req('GET', '/api/invoices/' + invoiceId, token);
  ok('GET invoice', r.status === 200, r.status);
  ok('Subtotal after 10% discount ~891', Math.abs((r.body?.subtotal ?? 0) - 891) < 0.05, r.body?.subtotal);

  r = await req('POST', '/api/invoices/' + invoiceId + '/finalize', token, {});
  ok(
    'Finalize with expected number',
    r.status < 300 && r.body?.invoiceNumber === expectedNumber,
    r.status + ' got=' + r.body?.invoiceNumber + ' expected=' + expectedNumber + ' status=' + r.body?.status,
  );

  r = await req('GET', '/api/settings/billing', token);
  ok(
    'RE next bumped',
    r.body?.series?.re?.nextNumber === startNext + 1,
    r.body?.series?.re?.nextNumber,
  );

  r = await req('GET', '/api/invoices/' + invoiceId + '/pdf', token);
  ok('PDF endpoint', r.status === 200 || r.status === 201, r.status);

  r = await req('POST', '/api/invoices/' + invoiceId + '/payments', token, {
    amount: 1000,
    paidDate: new Date().toISOString(),
    method: 'Ueberweisung',
    skontoApplied: true,
    skontoAmount: 20,
  });
  ok('Payment with skonto', r.status < 300, r.status + ' ' + JSON.stringify(r.body));

  r = await req('GET', '/api/invoices/skonto', token);
  const skontoOk =
    r.status === 200 &&
    (Array.isArray(r.body) ||
      Array.isArray(r.body?.items) ||
      Array.isArray(r.body?.payments) ||
      Array.isArray(r.body?.data));
  ok('Skonto list', skontoOk, r.status + ' ' + JSON.stringify(r.body).slice(0, 200));

  r = await req('POST', '/api/invoices/' + invoiceId + '/credit-note', token, {});
  ok(
    'Credit note GS',
    r.status < 300 && String(r.body?.invoiceNumber || '').startsWith('GS-'),
    r.status + ' ' + r.body?.invoiceNumber,
  );

  r = await req('POST', '/api/invoices', token, {
    invoiceType: 'OUTGOING',
    customerId: customer.id,
    projectId: project?.id,
    taxRate: 0,
    taxKind: 'REVERSE_CHARGE',
    performanceCountryCode: 'LU',
    periodFrom: '2026-09-01T00:00:00.000Z',
    periodTo: '2026-09-06T00:00:00.000Z',
  });
  const rcDraftId = r.body?.id;
  if (r.status >= 400) {
    ok(
      'RC without VAT-ID blocked at create',
      r.status >= 400 &&
        String(JSON.stringify(r.body)).toLowerCase().includes('ust'),
      r.status + ' ' + JSON.stringify(r.body).slice(0, 250),
    );
  } else {
    ok('RC draft create', !!rcDraftId, r.status + ' ' + JSON.stringify(r.body).slice(0, 200));
    if (rcDraftId) {
      await req('POST', '/api/invoices/' + rcDraftId + '/lines', token, {
        lineType: 'CUSTOM',
        description: 'RC Test',
        quantity: 1,
        unit: 'Pauschale',
        unitPrice: 100,
        position: 1,
      });
      r = await req('POST', '/api/invoices/' + rcDraftId + '/finalize', token, {});
      const blocked = r.status >= 400;
      ok('RC finalize without valid VIES blocked', blocked, r.status + ' ' + JSON.stringify(r.body).slice(0, 250));
      if (blocked) {
        await req('DELETE', '/api/invoices/' + rcDraftId, token);
      }
    }
  }

  r = await req('GET', '/api/invoice-products', token);
  ok('List products', r.status === 200, r.status);

  r = await req('POST', '/api/invoices', token, {
    invoiceType: 'INCOMING',
    customerId: customer.id,
  });
  ok('INCOMING create blocked', r.status === 403 || r.status === 400, r.status);

  // send-email may fail without BILLING email - just check endpoint exists
  r = await req('POST', '/api/invoices/' + invoiceId + '/send-email', token, {
    documentIds: [],
  });
  ok(
    'Send-email endpoint responds',
    r.status < 500,
    r.status + ' ' + JSON.stringify(r.body).slice(0, 250),
  );

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
