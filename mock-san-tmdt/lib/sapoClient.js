// lib/sapoClient.js — đẩy đơn từ mock server thành đơn THẬT trong Sapo
// Dựa theo tài liệu: support.sapo.vn/oauth, support.sapo.vn/phuong-thuc-post-cua-order-phan-2
//
// Cách lấy API Key / API Secret (không cần chờ duyệt, làm trong vài phút):
// 1. Vào https://ten-cua-hang.mysapo.net/admin -> Ứng dụng -> Ứng dụng riêng -> Tạo ứng dụng riêng
// 2. Đặt tên bất kỳ, ví dụ "Demo sàn ảo"
// 3. Ở Phân quyền Admin API, dòng "Đơn hàng, giao dịch và vận chuyển" chọn "Đọc và ghi"
// 4. Lưu lại -> sẽ hiện API Key và API Secret

const TAG_DEMO = "DEMO-SAN-AO"; // tag để nhận diện và dọn dẹp đơn demo sau này

let config = {
  domain: null, // ví dụ: ten-cua-hang.mysapo.net
  apiKey: null,
  apiSecret: null,
};

function configure({ domain, apiKey, apiSecret }) {
  config = { domain, apiKey, apiSecret };
}

function getConfig() {
  // không trả apiSecret ra ngoài để tránh lộ khi hiển thị trên dashboard
  return { domain: config.domain, apiKey: config.apiKey, hasSecret: !!config.apiSecret };
}

function isConfigured() {
  return !!(config.domain && config.apiKey && config.apiSecret);
}

function authHeader() {
  const token = Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64");
  return `Basic ${token}`;
}

function baseUrl() {
  const domain = config.domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${domain}/admin`;
}

// Chuyển financial_status nội bộ -> trạng thái Sapo hiểu
const FIN_STATUS_MAP = {
  PENDING: "pending",
  CONFIRMED: "pending",
  SHIPPING: "pending",
  COMPLETED: "paid",
  CANCELLED: "voided",
};

async function sapoFetch(path, { method = "GET", body } = {}) {
  if (!isConfigured()) throw new Error("Chưa cấu hình Sapo (domain / apiKey / apiSecret)");
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`Sapo API lỗi ${res.status}: ${JSON.stringify(json)}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

// Tạo 1 đơn THẬT trong Sapo từ dữ liệu đơn mock (Shopee/TikTok giả)
async function pushOrderToSapo(mockOrder) {
  const platformLabel = mockOrder.platform === "shopee" ? "Shopee (demo)" : "TikTok Shop (demo)";

  const payload = {
    order: {
      note: `Đơn demo mô phỏng đồng bộ từ ${platformLabel}. Mã mock: ${mockOrder.id}`,
      tags: TAG_DEMO,
      source_name: platformLabel,
      send_receipt: false,
      send_fulfillment_receipt: false,
      financial_status: FIN_STATUS_MAP[mockOrder.status] || "pending",
      line_items: mockOrder.items.map((it) => ({
        title: it.name,
        price: it.price,
        quantity: it.quantity,
      })),
      customer: {
        first_name: mockOrder.buyer_name,
        phone: mockOrder.buyer_phone,
      },
      shipping_address: {
        first_name: mockOrder.buyer_name,
        phone: mockOrder.buyer_phone,
        address1: mockOrder.shipping_address,
      },
    },
  };

  const result = await sapoFetch("/orders.json", { method: "POST", body: payload });
  return result.order; // chứa id, name (ví dụ #1002), order_number...
}

// Xóa 1 đơn demo khỏi Sapo bằng id Sapo đã trả về lúc tạo
async function deleteOrderFromSapo(sapoOrderId) {
  return sapoFetch(`/orders/${sapoOrderId}.json`, { method: "DELETE" });
}

// Tạo Fulfillment (giao hàng) cho toàn bộ đơn -> chuyển fulfillment_status sang "fulfilled"
async function createFulfillment(sapoOrderId) {
  return sapoFetch(`/orders/${sapoOrderId}/fulfillments.json`, {
    method: "POST",
    body: { fulfillment: {} }, // không truyền line_items = giao toàn bộ
  });
}

// Cập nhật trạng thái thanh toán của đơn trong Sapo
async function updateFinancialStatus(sapoOrderId, financial_status) {
  return sapoFetch(`/orders/${sapoOrderId}.json`, {
    method: "PUT",
    body: { order: { id: sapoOrderId, financial_status } },
  });
}

// Đồng bộ trạng thái mới nhất của đơn mock -> đơn thật trong Sapo.
// Gọi hàm này mỗi khi đơn mock đổi trạng thái (advance/cancel) VÀ đơn đã được đẩy vào Sapo trước đó.
async function syncStatusToSapo(mockOrder) {
  if (!mockOrder.sapo_order_id) return { skipped: true, reason: "chưa đẩy vào Sapo" };
  const steps = [];
  let fulfillmentCreated = false;

  // SHIPPING hoặc COMPLETED -> cần đã giao hàng (fulfilled), chỉ tạo 1 lần
  if ((mockOrder.status === "SHIPPING" || mockOrder.status === "COMPLETED") && !mockOrder.sapo_fulfillment_done) {
    try {
      await createFulfillment(mockOrder.sapo_order_id);
      fulfillmentCreated = true;
      steps.push({ step: "fulfillment", ok: true });
    } catch (err) {
      steps.push({ step: "fulfillment", ok: false, error: err.message });
    }
  }

  // COMPLETED -> đánh dấu đã thanh toán
  if (mockOrder.status === "COMPLETED") {
    try {
      await updateFinancialStatus(mockOrder.sapo_order_id, "paid");
      steps.push({ step: "financial_status", ok: true, value: "paid" });
    } catch (err) {
      steps.push({ step: "financial_status", ok: false, error: err.message });
    }
  }

  // CANCELLED -> đánh dấu hủy thanh toán
  if (mockOrder.status === "CANCELLED") {
    try {
      await updateFinancialStatus(mockOrder.sapo_order_id, "voided");
      steps.push({ step: "financial_status", ok: true, value: "voided" });
    } catch (err) {
      steps.push({ step: "financial_status", ok: false, error: err.message });
    }
  }

  return { skipped: false, fulfillmentCreated, steps };
}

module.exports = {
  configure,
  getConfig,
  isConfigured,
  pushOrderToSapo,
  deleteOrderFromSapo,
  syncStatusToSapo,
  TAG_DEMO,
};
