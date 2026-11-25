/**
 * Chạy TRƯỚC khi mỗi file E2E được nạp (jest-e2e.json → setupFiles), tức là trước khi AppModule gọi
 * ConfigModule.forRoot() và chụp lại môi trường. Biến đặt ở process.env ưu tiên hơn backend/.env.
 */
process.env.NODE_ENV = 'test';

// NV-01: cổng thanh toán mô phỏng mặc định TẮT; các suite E2E kiểm thử luồng mock nên bật tường minh.
// Nhánh "tắt cờ → 404/403" được kiểm bằng unit test (payments.service.spec.ts, checkout.service.spec.ts).
process.env.PAYMENT_MOCK_ENABLED = 'true';

export {};
