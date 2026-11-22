'use client';

import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ErrorMessage } from '../../../shared/components/feedback/error-message';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { ShopIcon } from '../../../shared/components/ui/shop-icon';
import { money, panel } from '../../cart-order/components/checkout-summary';
import type { Discounts, Quote } from '../../cart-order/types';
import { promotionApi } from '../services/promotion-api';
import type { Promotion } from '../types';

export function promotionValue(promotion: Promotion) {
  return promotion.type === 'FIXED'
    ? money(promotion.value)
    : `${promotion.value}%${promotion.maxDiscount ? ` (tối đa ${money(promotion.maxDiscount)})` : ''}`;
}

export function PromotionCodeInput({
  discounts,
  onChange,
  quote,
  updating,
}: {
  discounts: Discounts;
  onChange: (discounts: Discounts) => void;
  quote?: Quote;
  updating: boolean;
}) {
  const [code, setCode] = useState(discounts.voucherCode ?? '');
  const [points, setPoints] = useState(String(discounts.points ?? ''));
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const promotions = useQuery({
    queryKey: ['shopping', 'promotions'],
    queryFn: promotionApi.list,
    enabled: open,
  });
  const applyVoucher = (value: string) => {
    const voucherCode = value.trim().toUpperCase() || undefined;
    setCode(voucherCode ?? '');
    onChange({ ...discounts, voucherCode });
    dialog.current?.close();
  };
  const validPoints = /^\d*$/.test(points) && Number(points) <= 2_147_483_647;
  return (
    <section className={`${panel} space-y-4`}>
      <h2 className="text-lg font-semibold">Ưu đãi &amp; Điểm xanh</h2>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-38 flex-1">
          <Input
            label="Mã voucher"
            value={code}
            maxLength={32}
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                applyVoucher(code);
              }
            }}
          />
        </div>
        <Button variant="outline" onClick={() => applyVoucher(code)}>
          Áp dụng
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setOpen(true);
            dialog.current?.showModal();
          }}
        >
          Chọn voucher
        </Button>
      </div>
      {discounts.voucherCode && (
        <div className="flex items-start justify-between gap-3 text-sm">
          {quote?.voucherCode ? (
            <p className="flex items-center gap-1 text-primary-900">
              <ShopIcon name="check" /> {quote.voucherCode} · Giảm {money(quote.voucherDiscount)}
            </p>
          ) : (
            <p
              className="flex items-center gap-2 text-red-700"
              role={quote?.promotionError ? 'alert' : undefined}
            >
              {quote?.promotionError && <ShopIcon name="alert" />}
              {quote?.promotionError ?? discounts.voucherCode}
            </p>
          )}
          <button
            type="button"
            onClick={() => applyVoucher('')}
            className="shrink-0 font-medium text-primary-900 underline"
          >
            Bỏ voucher
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2 border-t border-gray-100 pt-4">
        <div className="min-w-38 flex-1">
          <Input
            label="Điểm xanh muốn dùng"
            inputMode="numeric"
            value={points}
            maxLength={10}
            onChange={(event) => setPoints(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (validPoints) onChange({ ...discounts, points: Number(points) });
              }
            }}
          />
        </div>
        <Button
          variant="outline"
          disabled={!validPoints}
          onClick={() => onChange({ ...discounts, points: Number(points) })}
        >
          Dùng điểm
        </Button>
        {!!discounts.points && (
          <Button
            variant="ghost"
            onClick={() => {
              setPoints('');
              onChange({ ...discounts, points: 0 });
            }}
          >
            Bỏ điểm
          </Button>
        )}
      </div>
      {quote && (
        <p className="text-sm text-gray-600">
          Số dư {BigInt(quote.pointBalance).toLocaleString('vi-VN')} điểm · 1 điểm ={' '}
          {money(quote.pointValue)} · Tối đa {quote.pointLimit.toLocaleString('vi-VN')} điểm cho đơn
          này
        </p>
      )}
      {!validPoints && (
        <p role="alert" className="text-sm text-red-700">
          Nhập số điểm nguyên hợp lệ.
        </p>
      )}
      {quote?.pointsError && (
        <p role="alert" className="text-sm text-red-700">
          {quote.pointsError}
        </p>
      )}
      {updating && (
        <p role="status" className="text-sm text-gray-600">
          Đang cập nhật giá…
        </p>
      )}
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-labelledby="voucher-picker-title"
        className="m-auto max-h-[85vh] w-[min(92vw,35rem)] overflow-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl backdrop:bg-black/35"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 id="voucher-picker-title" className="text-lg font-semibold">
            Chọn voucher
          </h3>
          <button type="button" aria-label="Đóng" onClick={() => dialog.current?.close()}>
            <ShopIcon name="close" />
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          Dùng một voucher cho tiền hàng, có thể kết hợp với Điểm xanh.
        </p>
        {promotions.isPending && <p role="status">Đang tải voucher…</p>}
        {promotions.data?.length === 0 && <p>Chưa có voucher đang áp dụng.</p>}
        <ErrorMessage error={promotions.error} />
        <ul className="space-y-2">
          {promotions.data?.map((promotion) => {
            const missing = quote
              ? Math.max(0, Number(promotion.minSubtotal) - Number(quote.subtotal))
              : 0;
            return (
              <li
                key={promotion.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 p-3 text-sm"
              >
                <div className="min-w-52 flex-1">
                  <p className="font-semibold">
                    {promotion.code} · Giảm {promotionValue(promotion)}
                  </p>
                  <p className="text-gray-600">
                    {promotion.name} · Đơn từ {money(promotion.minSubtotal)}
                  </p>
                  {missing > 0 && (
                    <p className="font-medium text-red-700">Còn thiếu {money(missing)} tiền hàng</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={missing > 0}
                  onClick={() => applyVoucher(promotion.code)}
                >
                  Chọn
                </Button>
              </li>
            );
          })}
        </ul>
      </dialog>
    </section>
  );
}
