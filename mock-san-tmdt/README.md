# Mock Sàn TMĐT — Shopee & TikTok Shop (dùng để demo phần mềm)

Mock server này giả lập cấu trúc dữ liệu & endpoint giống Shopee Open Platform và
TikTok Shop Partner API, để bạn demo phần mềm quản lý đơn/kho mà không cần tài
khoản sandbox thật.

## 1. Chạy server

Yêu cầu: Node.js 18 trở lên (dùng `fetch` có sẵn trong Node).

```bash
cd mock-san-tmdt
npm install
npm start
```

Server chạy ở `http://localhost:4000`.

- Dashboard demo (xem bằng mắt, bấm nút để tạo/đổi trạng thái đơn):
  `http://localhost:4000/`
- API giả lập Shopee: `http://localhost:4000/shopee/api/v2/...`
- API giả lập TikTok Shop: `http://localhost:4000/tiktok/api/...`

## 2. Các endpoint chính

### Shopee-style

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/shopee/api/v2/auth/token/get` | Giả lập đổi code lấy access_token |
| GET | `/shopee/api/v2/order/get_order_list` | Danh sách đơn |
| GET | `/shopee/api/v2/order/get_order_detail?order_sn_list=...` | Chi tiết đơn |
| GET | `/shopee/api/v2/product/get_item_list` | Danh sách sản phẩm |
| POST | `/shopee/api/v2/logistics/ship_order` | Chuyển đơn sang bước giao tiếp theo (đẩy webhook) |

### TikTok Shop-style

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/tiktok/api/v2/token/get` | Giả lập lấy access_token |
| GET | `/tiktok/api/orders/search` | Danh sách đơn |
| GET | `/tiktok/api/orders/detail?order_id_list=...` | Chi tiết đơn |
| GET | `/tiktok/api/products/search` | Danh sách sản phẩm |
| POST | `/tiktok/api/fulfillment/ship` | Chuyển đơn sang bước tiếp theo (đẩy webhook) |

### Admin (dùng cho dashboard, hoặc bạn có thể gọi trực tiếp để test)

- `GET /admin/orders?platform=shopee|tiktok|all`
- `POST /admin/orders/random` — body `{ "platform": "shopee", "count": 5 }`
- `POST /admin/orders/:id/advance` — chuyển trạng thái tiếp theo
- `POST /admin/orders/:id/cancel`
- `POST /admin/reset`
- `GET /admin/webhook` / `POST /admin/webhook` — body `{ "url": "..." }`

## 3. Vòng đời trạng thái đơn

Nội bộ dùng chung 1 vòng đời, map ra tên riêng của từng sàn khi trả JSON:

```
PENDING → CONFIRMED → SHIPPING → COMPLETED
                              ↘ CANCELLED (có thể hủy ở PENDING/CONFIRMED/SHIPPING)
```

| Nội bộ | Shopee trả về | TikTok Shop trả về |
|---|---|---|
| PENDING | UNPAID | AWAITING_SHIPMENT |
| CONFIRMED | READY_TO_SHIP | AWAITING_COLLECTION |
| SHIPPING | SHIPPED | IN_TRANSIT |
| COMPLETED | COMPLETED | DELIVERED |
| CANCELLED | CANCELLED | CANCELLED |

## 4. Kết nối phần mềm của bạn để nhận webhook

1. Chạy phần mềm của bạn, mở sẵn một endpoint nhận webhook (ví dụ `POST /webhook`).
2. Nếu phần mềm chạy local, dùng **ngrok** để có URL public:
   ```bash
   ngrok http <port_phan_mem_cua_ban>
   ```
3. Dán URL ngrok vào ô "Webhook URL" trên dashboard (`http://localhost:4000/`) và nhấn Lưu.
4. Trên dashboard, bấm "Chuyển trạng thái tiếp" ở một đơn bất kỳ — mock server sẽ
   POST một payload giống Shopee/TikTok gửi về webhook của bạn.

Payload gửi đi (ví dụ Shopee):
```json
{
  "code": 3,
  "shop_id": 999000111,
  "timestamp": 1732000000,
  "data": { "ordersn": "SPVN12345671", "status": "SHIPPED", "update_time": 1732000000 }
}
```

Payload TikTok Shop tương tự nhưng dùng `order_id`, `order_status`.

## 5. Sau này chuyển sang sandbox/production thật

Vì cấu trúc JSON ở đây được thiết kế bám sát field name thật của 2 sàn, khi bạn
được duyệt sandbox hoặc production thật, phần code gọi API trong phần mềm chỉ cần:

- Đổi `base URL` từ `http://localhost:4000/shopee/...` → host sandbox/production thật.
- Thêm bước ký request (HMAC) theo đúng tài liệu của từng sàn (mock này không ký).
- Đổi luồng lấy `access_token` sang OAuth thật (có bước người bán bấm "Cho phép").

## 6. Giới hạn của bản mock

- Dữ liệu lưu trong RAM, **mất khi restart server** (phù hợp cho demo ngắn, không phải lưu trữ lâu dài).
- Không ký request bằng HMAC như API thật — chỉ mô phỏng cấu trúc dữ liệu & luồng trạng thái.
- Dùng cho mục đích demo nội bộ/khách hàng xem thử, không nên gắn nhãn "Shopee"/"TikTok Shop" thật trên giao diện khi trình chiếu, để tránh gây hiểu nhầm đây là kết nối thật.
