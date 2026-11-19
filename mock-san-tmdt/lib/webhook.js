// lib/webhook.js — đẩy sự kiện thay đổi đơn hàng về webhook URL của phần mềm bạn
// Mô phỏng cơ chế push notification của Shopee / webhook của TikTok Shop.
// Đây chỉ là giả lập cho demo, không phải chữ ký bảo mật thật của 2 sàn.

let webhookUrl = null;
let lastError = null;
let lastSentAt = null;

function setWebhookUrl(url) {
  webhookUrl = url || null;
}

function getWebhookStatus() {
  return { webhookUrl, lastError, lastSentAt };
}

function buildPayload(order) {
  if (order.platform === "shopee") {
    // Giống cấu trúc push notification của Shopee Open Platform (code 3 = order status push)
    return {
      code: 3,
      shop_id: 999000111,
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        ordersn: order.id,
        status: order.status, // PENDING / CONFIRMED / SHIPPING / COMPLETED / CANCELLED
        update_time: Math.floor(order.update_time / 1000),
      },
    };
  }
  // Giống cấu trúc webhook của TikTok Shop
  return {
    type: 1, // ORDER_STATUS_CHANGE (giả lập)
    shop_id: "7000111222",
    timestamp: Math.floor(Date.now() / 1000),
    data: {
      order_id: order.id,
      order_status: order.status,
      update_time: Math.floor(order.update_time / 1000),
    },
  };
}

async function pushEvent(order) {
  if (!webhookUrl) return { skipped: true, reason: "chưa cấu hình webhook URL" };
  const payload = buildPayload(order);
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Mock-Platform": order.platform,
      },
      body: JSON.stringify(payload),
    });
    lastSentAt = Date.now();
    lastError = res.ok ? null : `HTTP ${res.status}`;
    return { skipped: false, ok: res.ok, status: res.status, payload };
  } catch (err) {
    lastError = err.message;
    lastSentAt = Date.now();
    return { skipped: false, ok: false, error: err.message, payload };
  }
}

module.exports = { setWebhookUrl, getWebhookStatus, pushEvent };
