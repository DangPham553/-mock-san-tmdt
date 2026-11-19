// lib/store.js — lưu trữ đơn hàng trong bộ nhớ (reset khi restart server)

const { randomName, randomPhone, randomAddress, randomLineItems, SAN_PHAM } = require("./data");

let orders = [];
let nextSeq = 1;

// Vòng đời trạng thái nội bộ, dùng chung cho cả 2 sàn.
// Mỗi sàn sẽ map sang tên trạng thái riêng của họ khi trả JSON (xem routes/*.js)
const FLOW = ["PENDING", "CONFIRMED", "SHIPPING", "COMPLETED"];
const CANCELLED = "CANCELLED";

function genOrderId(platform) {
  const prefix = platform === "shopee" ? "SPVN" : "TTVN";
  const id = `${prefix}${Date.now().toString().slice(-8)}${nextSeq++}`;
  return id;
}

function createOrder(platform) {
  const items = randomLineItems();
  const total = items.reduce((s, it) => s + it.price * it.quantity, 0);
  const order = {
    id: genOrderId(platform),
    platform, // "shopee" | "tiktok"
    status: "PENDING",
    buyer_name: randomName(),
    buyer_phone: randomPhone(),
    shipping_address: randomAddress(),
    items,
    total_amount: total,
    create_time: Date.now(),
    update_time: Date.now(),
  };
  orders.unshift(order);
  return order;
}

function createRandomOrders(platform, count) {
  const created = [];
  for (let i = 0; i < count; i++) created.push(createOrder(platform));
  return created;
}

function getOrders(platform) {
  if (!platform || platform === "all") return orders;
  return orders.filter((o) => o.platform === platform);
}

function getOrderById(id) {
  return orders.find((o) => o.id === id);
}

function advanceStatus(id) {
  const order = getOrderById(id);
  if (!order) return null;
  if (order.status === CANCELLED || order.status === "COMPLETED") return order;
  const idx = FLOW.indexOf(order.status);
  if (idx < FLOW.length - 1) {
    order.status = FLOW[idx + 1];
    order.update_time = Date.now();
  }
  return order;
}

function setSapoInfo(id, sapoOrderId, sapoOrderName) {
  const order = getOrderById(id);
  if (!order) return null;
  order.sapo_order_id = sapoOrderId;
  order.sapo_order_name = sapoOrderName;
  if (!sapoOrderId) order.sapo_fulfillment_done = false; // reset khi gỡ liên kết
  return order;
}

function markFulfillmentDone(id) {
  const order = getOrderById(id);
  if (order) order.sapo_fulfillment_done = true;
  return order;
}

function cancelOrder(id) {
  const order = getOrderById(id);
  if (!order) return null;
  if (order.status === "COMPLETED") return order; // không hủy đơn đã hoàn tất
  order.status = CANCELLED;
  order.update_time = Date.now();
  return order;
}

function resetAll() {
  orders = [];
  nextSeq = 1;
}

module.exports = {
  createOrder,
  createRandomOrders,
  getOrders,
  getOrderById,
  advanceStatus,
  cancelOrder,
  setSapoInfo,
  markFulfillmentDone,
  resetAll,
  SAN_PHAM,
};
