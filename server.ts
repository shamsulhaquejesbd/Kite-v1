import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  claimFirstAdmin,
  getAuthStatus,
  loginWithPasscode,
  requireAdmin,
  verifySupabaseAdminToken,
} from './server/auth.ts';
import {
  adjustInventoryAdmin,
  deleteDeliveryZoneAdmin,
  deleteProductAdmin,
  deleteReviewAdmin,
  getAllOrders,
  getAllProductsAdmin,
  getCategoriesAdmin,
  getCmsAdminData,
  getDashboardMetrics,
  getOrderById,
  getStockMovementsAdmin,
  getStorefrontData,
  placeCustomerOrder,
  saveDeliveryZoneAdmin,
  saveProductAdmin,
  saveReviewAdmin,
  seedSupabaseInitialCatalog,
  subscribeNewsletter,
  trackCustomerOrder,
  updateHomepageSectionsAdmin,
  updateOrderDetails,
  updateOrderStatus,
  updateWebsiteSettingsAdmin,
  updateWhatsappTemplatesAdmin,
  uploadCroppedMedia,
} from './server/store.ts';
import { isSupabaseConfigured, missingSupabaseVars } from './server/supabase.ts';
import { ORDER_STATUSES, type OrderStatus } from './src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.set('trust proxy', true);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Serve uploaded media assets safely
  const uploadsDir = path.resolve(__dirname, 'public', 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));

  // ========================================================================
  // PUBLIC API ROUTES
  // ========================================================================

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      supabaseConfigured: isSupabaseConfigured,
      missingSupabaseVars,
    });
  });

  app.get('/api/storefront', async (_req, res) => {
    try {
      const payload = await getStorefrontData();
      res.json(payload);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/orders', async (req, res) => {
    try {
      const order = await placeCustomerOrder(req.body);
      res.status(201).json({ order });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/orders/track', async (req, res) => {
    try {
      const { order_number, phone } = req.body || {};
      const tracked = await trackCustomerOrder(order_number, phone);
      if (!tracked) {
        res.status(404).json({
          error: 'No matching order found. Please check your Order ID and Mobile Number.',
        });
        return;
      }
      res.json({ order: tracked });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/newsletter', async (req, res) => {
    try {
      await subscribeNewsletter(req.body?.email || '');
      res.json({ ok: true, message: 'Thank you for subscribing to THE KITE dispatch.' });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // ========================================================================
  // ADMIN AUTH ROUTES
  // ========================================================================

  app.get('/api/admin/auth/status', (_req, res) => {
    res.json({
      ...getAuthStatus(),
      missingSupabaseVars,
    });
  });

  app.post('/api/admin/auth/claim', (req, res) => {
    const { email, password } = req.body || {};
    const result = claimFirstAdmin(email || '', password || '');
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ token: result.token, admin: result.admin });
  });

  app.post('/api/admin/auth/login', async (req, res) => {
    const { email, password, supabaseAccessToken } = req.body || {};
    if (supabaseAccessToken && isSupabaseConfigured) {
      const sbAdmin = await verifySupabaseAdminToken(supabaseAccessToken);
      if (!sbAdmin) {
        res.status(403).json({
          error: 'Your Supabase account is not registered as an active administrator.',
        });
        return;
      }
      res.json({ token: supabaseAccessToken, admin: sbAdmin });
      return;
    }

    const result = loginWithPasscode(email || '', password || '');
    if (!result.ok) {
      res.status(401).json({ error: result.error });
      return;
    }
    res.json({ token: result.token, admin: result.admin });
  });

  app.get('/api/admin/auth/me', requireAdmin, (req, res) => {
    res.json({ admin: req.adminUser });
  });

  // ========================================================================
  // PROTECTED ADMIN ROUTES
  // ========================================================================

  app.get('/api/admin/system/sql', requireAdmin, (_req, res) => {
    try {
      const schemaSql = fs.readFileSync(
        path.resolve(__dirname, 'supabase', 'migrations', '001_initial_schema.sql'),
        'utf8'
      );
      const seedSql = fs.readFileSync(
        path.resolve(__dirname, 'supabase', 'migrations', '002_seed_data.sql'),
        'utf8'
      );
      res.json({
        supabaseConfigured: isSupabaseConfigured,
        missingSupabaseVars,
        schemaSql,
        seedSql,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/admin/system/seed-supabase', requireAdmin, async (req, res) => {
    try {
      const result = await seedSupabaseInitialCatalog(req.adminUser?.name || 'Admin');
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.get('/api/admin/dashboard', requireAdmin, async (_req, res) => {
    try {
      const metrics = await getDashboardMetrics();
      res.json(metrics);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Orders Management
  app.get('/api/admin/orders', requireAdmin, async (_req, res) => {
    try {
      const orders = await getAllOrders();
      res.json({ orders });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/admin/orders/:id', requireAdmin, async (req, res) => {
    try {
      const order = await getOrderById(String(req.params.id));
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
      res.json({ order });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
    try {
      const { status, note } = req.body || {};
      if (!ORDER_STATUSES.includes(status as OrderStatus)) {
        res.status(400).json({ error: 'Invalid order status' });
        return;
      }
      const order = await updateOrderStatus(
        String(req.params.id),
        status as OrderStatus,
        note || '',
        req.adminUser?.name || 'Admin'
      );
      res.json({ order });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.patch('/api/admin/orders/:id', requireAdmin, async (req, res) => {
    try {
      const order = await updateOrderDetails(String(req.params.id), req.body || {});
      res.json({ order });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Products Management
  app.get('/api/admin/products', requireAdmin, async (_req, res) => {
    try {
      const [products, categories] = await Promise.all([
        getAllProductsAdmin(),
        getCategoriesAdmin(),
      ]);
      res.json({ products, categories });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/admin/products', requireAdmin, async (req, res) => {
    try {
      const product = await saveProductAdmin(req.body || {}, req.adminUser?.name || 'Admin');
      res.status(201).json({ product });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
    try {
      const product = await saveProductAdmin(
        { ...(req.body || {}), id: String(req.params.id) },
        req.adminUser?.name || 'Admin'
      );
      res.json({ product });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
    try {
      await deleteProductAdmin(String(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Inventory Management
  app.get('/api/admin/inventory', requireAdmin, async (_req, res) => {
    try {
      const [products, movements] = await Promise.all([
        getAllProductsAdmin(),
        getStockMovementsAdmin(),
      ]);
      res.json({ products, movements });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/admin/inventory/adjust', requireAdmin, async (req, res) => {
    try {
      const { product_id, delta, movement_type, reason } = req.body || {};
      const result = await adjustInventoryAdmin(
        product_id,
        delta,
        movement_type === 'purchase' ? 'purchase' : 'adjustment',
        reason || '',
        req.adminUser?.name || 'Admin'
      );
      res.json({ result });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // CMS & Settings Management
  app.get('/api/admin/cms', requireAdmin, async (_req, res) => {
    try {
      const cms = await getCmsAdminData();
      res.json(cms);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/admin/cms/settings', requireAdmin, async (req, res) => {
    try {
      const settings = await updateWebsiteSettingsAdmin(req.body || {});
      res.json({ settings });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.put('/api/admin/cms/sections', requireAdmin, async (req, res) => {
    try {
      const sections = await updateHomepageSectionsAdmin(req.body || {});
      res.json({ sections });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/admin/cms/reviews', requireAdmin, async (req, res) => {
    try {
      const review = await saveReviewAdmin(req.body || {});
      res.status(201).json({ review });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.put('/api/admin/cms/reviews/:id', requireAdmin, async (req, res) => {
    try {
      const review = await saveReviewAdmin({ ...(req.body || {}), id: String(req.params.id) });
      res.json({ review });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/admin/cms/reviews/:id', requireAdmin, async (req, res) => {
    try {
      await deleteReviewAdmin(String(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.put('/api/admin/settings/whatsapp-templates', requireAdmin, async (req, res) => {
    try {
      const templates = await updateWhatsappTemplatesAdmin(req.body?.templates || []);
      res.json({ whatsappTemplates: templates });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/admin/settings/delivery-zones', requireAdmin, async (req, res) => {
    try {
      const zone = await saveDeliveryZoneAdmin(req.body || {});
      res.status(201).json({ zone });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.put('/api/admin/settings/delivery-zones/:id', requireAdmin, async (req, res) => {
    try {
      const zone = await saveDeliveryZoneAdmin({ ...(req.body || {}), id: String(req.params.id) });
      res.json({ zone });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/admin/settings/delivery-zones/:id', requireAdmin, async (req, res) => {
    try {
      await deleteDeliveryZoneAdmin(String(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Cropped Media Upload
  app.post('/api/admin/media/upload', requireAdmin, async (req, res) => {
    try {
      const { dataUrl, folder, fileName } = req.body || {};
      const result = await uploadCroppedMedia(dataUrl, folder || 'general', fileName);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Ensure unknown /api/* routes and API errors return JSON rather than SPA HTML
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  app.use(
    '/api',
    (
      err: Error & { status?: number; statusCode?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const status = err?.status || err?.statusCode || 500;
      res.status(status).json({ error: err?.message || 'Internal server error' });
    }
  );

  // ========================================================================
  // VITE / STATIC FRONTEND HANDOFF
  // ========================================================================

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.get('/@vite/client', async (req, res, next) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (!result) return next();
        const patched = result.code.replace(
          'transport.connect(createHMRHandler(handleMessage));',
          '/* HMR WebSocket disabled */'
        );
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.send(patched);
      } catch (err) {
        next(err);
      }
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`THE KITE platform listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server error:', err);
  process.exit(1);
});
