// server.js — Mock server giả lập API Shopee Open Platform & TikTok Shop
// Chạy: npm install && npm start  (mặc định cổng 4000)

const express = require("express");
const cors = require("cors");
const path = require("path");
const store = require("./lib/store");
const webhook = require("./lib/webhook");
const sapo = require("./lib/sapoClient");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------------------------------------------------------
// SHOPEE-STYLE API (mô phỏng cấu trúc Shopee Open Platform v2)
// ---------------------------------------------------------------------------

const SHOPEE_STATUS_MAP = {
  PENDING: "UNPAID",
  CONFIRMED: "READY_TO_SHIP",
  SHIPPING: "SHIPPED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

function toShopeeOrder(o) {
  return {
    ordersn: o.id,
    order_status: SHOPEE_STATUS_MAP[o.status] || o.status,
    buyer_username: o.buyer_name,
    recipient_address: {
      name: o.buyer_name,
      phone: o.buyer_phone,
      full_address: o.shipping_address,
    },
    item_list: o.items.map((it) => ({
      item_name: it.name,
      item_sku: it.sku,
      model_quantity_purchased: it.quantity,
      model_discounted_price: it.price,
    })),
    total_amount: o.total_amount,
    create_time: Math.floor(o.create_time / 1000),
    update_time: Math.floor(o.update_time / 1000),
  };
}

// Giả lập exchange code lấy access_token (OAuth)
app.post("/shopee/api/v2/auth/token/get", (req, res) => {
  res.json({
    access_token: "mock_shopee_access_token_" + Date.now(),
    refresh_token: "mock_shopee_refresh_token",
    expire_in: 14400,
    shop_id: 999000111,
  });
});

app.get("/shopee/api/v2/order/get_order_list", (req, res) => {
  const orders = store.getOrders("shopee");
  res.json({
    error: "",
    message: "",
    response: {
      order_list: orders.map((o) => ({ ordersn: o.id, order_status: SHOPEE_STATUS_MAP[o.status] })),
      more: false,
    },
  });
});

app.get("/shopee/api/v2/order/get_order_detail", (req, res) => {
  const list = (req.query.order_sn_list || "").split(",").filter(Boolean);
  const orders = store.getOrders("shopee").filter((o) => list.includes(o.id));
  res.json({ error: "", message: "", response: { order_list: orders.map(toShopeeOrder) } });
});

app.get("/shopee/api/v2/product/get_item_list", (req, res) => {
  res.json({
    error: "",
    message: "",
    response: {
      item: store.SAN_PHAM.map((sp, idx) => ({ item_id: 1000 + idx, item_sku: sp.sku, item_name: sp.name })),
      total_count: store.SAN_PHAM.length,
    },
  });
});

// Giả lập thao tác "giao hàng" làm đơn chuyển trạng thái, giống hành vi thật
app.post("/shopee/api/v2/logistics/ship_order", async (req, res) => {
  const { order_sn } = req.body || {};
  const order = store.advanceStatus(order_sn);
  if (!order) return res.status(404).json({ error: "order_not_found" });
  await webhook.pushEvent(order);
  res.json({ error: "", message: "success" });
});

// ---------------------------------------------------------------------------
// TIKTOK SHOP-STYLE API (mô phỏng cấu trúc TikTok Shop Partner API)
// ---------------------------------------------------------------------------

const TIKTOK_STATUS_MAP = {
  PENDING: "AWAITING_SHIPMENT",
  CONFIRMED: "AWAITING_COLLECTION",
  SHIPPING: "IN_TRANSIT",
  COMPLETED: "DELIVERED",
  CANCELLED: "CANCELLED",
};

function toTiktokOrder(o) {
  return {
    order_id: o.id,
    order_status: TIKTOK_STATUS_MAP[o.status] || o.status,
    recipient_address: {
      name: o.buyer_name,
      phone_number: o.buyer_phone,
      full_address: o.shipping_address,
    },
    line_items: o.items.map((it) => ({
      product_name: it.name,
      seller_sku: it.sku,
      sale_price: String(it.price),
      quantity: it.quantity,
    })),
    payment: { total_amount: String(o.total_amount), currency: "VND" },
    create_time: Math.floor(o.create_time / 1000),
    update_time: Math.floor(o.update_time / 1000),
  };
}

app.post("/tiktok/api/v2/token/get", (req, res) => {
  res.json({
    data: {
      access_token: "mock_tiktok_access_token_" + Date.now(),
      refresh_token: "mock_tiktok_refresh_token",
      access_token_expire_in: 86400,
      seller_name: "Shop Demo TikTok",
    },
  });
});

app.get("/tiktok/api/orders/search", (req, res) => {
  const orders = store.getOrders("tiktok");
  res.json({
    data: {
      order_list: orders.map((o) => ({ order_id: o.id, order_status: TIKTOK_STATUS_MAP[o.status] })),
      total_count: orders.length,
    },
  });
});

app.get("/tiktok/api/orders/detail", (req, res) => {
  const idsParam = req.query.order_id_list || req.query.order_id || "";
  const ids = idsParam.split(",").filter(Boolean);
  const orders = store.getOrders("tiktok").filter((o) => ids.includes(o.id));
  res.json({ data: { order_list: orders.map(toTiktokOrder) } });
});

app.get("/tiktok/api/products/search", (req, res) => {
  res.json({
    data: {
      products: store.SAN_PHAM.map((sp, idx) => ({ product_id: String(2000 + idx), seller_sku: sp.sku, product_name: sp.name })),
      total_count: store.SAN_PHAM.length,
    },
  });
});

app.post("/tiktok/api/fulfillment/ship", async (req, res) => {
  const { order_id } = req.body || {};
  const order = store.advanceStatus(order_id);
  if (!order) return res.status(404).json({ code: 404, message: "order not found" });
  await webhook.pushEvent(order);
  res.json({ code: 0, message: "success" });
});

// ---------------------------------------------------------------------------
// ADMIN / DASHBOARD API — dùng cho trang demo public/index.html
// ---------------------------------------------------------------------------

app.get("/admin/orders", (req, res) => {
  const platform = req.query.platform || "all";
  res.json({ orders: store.getOrders(platform) });
});

app.post("/admin/orders/random", (req, res) => {
  const { platform = "shopee", count = 5 } = req.body || {};
  const created = store.createRandomOrders(platform, Number(count));
  res.json({ created });
});

app.post("/admin/orders/:id/advance", async (req, res) => {
  const order = store.advanceStatus(req.params.id);
  if (!order) return res.status(404).json({ error: "not_found" });
  const pushResult = await webhook.pushEvent(order);
  let sapoSync = null;
  if (order.sapo_order_id) {
    sapoSync = await sapo.syncStatusToSapo(order);
    if (sapoSync.fulfillmentCreated) store.markFulfillmentDone(order.id);
  }
  res.json({ order, pushResult, sapoSync });
});

app.post("/admin/orders/:id/cancel", async (req, res) => {
  const order = store.cancelOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "not_found" });
  const pushResult = await webhook.pushEvent(order);
  let sapoSync = null;
  if (order.sapo_order_id) {
    sapoSync = await sapo.syncStatusToSapo(order);
  }
  res.json({ order, pushResult, sapoSync });
});

app.post("/admin/reset", (req, res) => {
  store.resetAll();
  res.json({ ok: true });
});

app.get("/admin/webhook", (req, res) => {
  res.json(webhook.getWebhookStatus());
});

app.post("/admin/webhook", (req, res) => {
  webhook.setWebhookUrl(req.body.url);
  res.json(webhook.getWebhookStatus());
});

// --- Tích hợp Sapo: đẩy đơn demo thành đơn thật ---

app.get("/admin/sapo-config", (req, res) => {
  res.json({ ...sapo.getConfig(), configured: sapo.isConfigured() });
});

app.post("/admin/sapo-config", (req, res) => {
  const { domain, apiKey, apiSecret } = req.body || {};
  sapo.configure({ domain, apiKey, apiSecret });
  res.json({ ...sapo.getConfig(), configured: sapo.isConfigured() });
});

app.post("/admin/orders/:id/push-to-sapo", async (req, res) => {
  const order = store.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "not_found" });
  if (!sapo.isConfigured()) {
    return res.status(400).json({ error: "sapo_not_configured", message: "Chưa cấu hình domain/API Key/API Secret của Sapo" });
  }
  try {
    const sapoOrder = await sapo.pushOrderToSapo(order);
    store.setSapoInfo(order.id, sapoOrder.id, sapoOrder.name);
    // Nếu đơn mock đã ở trạng thái nâng cao (SHIPPING/COMPLETED/CANCELLED) trước khi đẩy, đồng bộ luôn
    const sapoSync = await sapo.syncStatusToSapo(order);
    if (sapoSync.fulfillmentCreated) store.markFulfillmentDone(order.id);
    res.json({ ok: true, sapo_order: { id: sapoOrder.id, name: sapoOrder.name }, sapoSync });
  } catch (err) {
    res.status(502).json({ error: "sapo_push_failed", message: err.message });
  }
});

app.post("/admin/orders/:id/remove-from-sapo", async (req, res) => {
  const order = store.getOrderById(req.params.id);
  if (!order || !order.sapo_order_id) return res.status(404).json({ error: "not_pushed" });
  try {
    await sapo.deleteOrderFromSapo(order.sapo_order_id);
    store.setSapoInfo(order.id, null, null);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: "sapo_delete_failed", message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Mock sàn TMĐT đang chạy tại http://localhost:${PORT}`);
  console.log(`Dashboard demo:            http://localhost:${PORT}/`);
  console.log(`Shopee-style API base:     http://localhost:${PORT}/shopee/api/v2`);
  console.log(`TikTok Shop-style API base: http://localhost:${PORT}/tiktok/api`);
});
