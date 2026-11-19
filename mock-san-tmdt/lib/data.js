// lib/data.js — dữ liệu mẫu tiếng Việt để sinh đơn hàng giả

const HO = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ"];
const TEN_DEM = ["Văn", "Thị", "Hữu", "Minh", "Ngọc", "Thanh", "Thu", "Quốc", "Gia", "Bảo"];
const TEN = ["An", "Bình", "Châu", "Dũng", "Hà", "Hạnh", "Hùng", "Lan", "Linh", "Mai", "Nam", "Nhi", "Phúc", "Quân", "Thảo", "Trang", "Tuấn", "Vy"];

const TINH_THANH = [
  "Quận 1, TP. Hồ Chí Minh",
  "Quận 7, TP. Hồ Chí Minh",
  "Thủ Đức, TP. Hồ Chí Minh",
  "Cầu Giấy, Hà Nội",
  "Hai Bà Trưng, Hà Nội",
  "Hải Châu, Đà Nẵng",
  "Ninh Kiều, Cần Thơ",
  "Biên Hòa, Đồng Nai",
  "Thuận An, Bình Dương",
  "Nha Trang, Khánh Hòa",
];

const SAN_PHAM = [
  { name: "Áo thun cotton basic", price: 129000, sku: "AT-BASIC-001" },
  { name: "Quần jean nam slimfit", price: 349000, sku: "QJ-SLIM-014" },
  { name: "Tai nghe bluetooth TWS", price: 259000, sku: "TN-TWS-022" },
  { name: "Ốp lưng điện thoại silicon", price: 39000, sku: "OP-SIL-105" },
  { name: "Bình giữ nhiệt 500ml", price: 159000, sku: "BGN-500-003" },
  { name: "Son dưỡng môi không màu", price: 45000, sku: "SD-NM-087" },
  { name: "Sạc dự phòng 10000mAh", price: 299000, sku: "SDP-10K-041" },
  { name: "Dép lào unisex", price: 69000, sku: "DEP-UNI-009" },
  { name: "Balo laptop chống nước", price: 389000, sku: "BLP-CW-056" },
  { name: "Nồi chiên không dầu 4L", price: 890000, sku: "NCKD-4L-073" },
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomName() {
  return `${pick(HO)} ${pick(TEN_DEM)} ${pick(TEN)}`;
}

function randomPhone() {
  const dauSo = ["090", "091", "092", "093", "094", "096", "097", "098", "032", "033", "070", "079"];
  let so = pick(dauSo);
  for (let i = 0; i < 7; i++) so += Math.floor(Math.random() * 10);
  return so;
}

function randomAddress() {
  const soNha = Math.floor(Math.random() * 200) + 1;
  const duong = ["Lê Lợi", "Nguyễn Huệ", "Trần Hưng Đạo", "Cách Mạng Tháng 8", "Hai Bà Trưng", "Điện Biên Phủ"];
  return `${soNha} ${pick(duong)}, ${pick(TINH_THANH)}`;
}

function randomLineItems() {
  const soLuongMon = Math.floor(Math.random() * 2) + 1; // 1-2 loại sản phẩm / đơn
  const items = [];
  for (let i = 0; i < soLuongMon; i++) {
    const sp = pick(SAN_PHAM);
    const qty = Math.floor(Math.random() * 3) + 1;
    items.push({ name: sp.name, sku: sp.sku, price: sp.price, quantity: qty });
  }
  return items;
}

module.exports = { randomName, randomPhone, randomAddress, randomLineItems, SAN_PHAM };
