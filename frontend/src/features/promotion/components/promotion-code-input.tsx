'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ErrorMessage } from '../../../shared/components/feedback/error-message';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { ShopIcon } from '../../../shared/components/ui/shop-icon';
import { cn } from '../../../shared/utils/cn.util';
import { money, panel } from '../../cart-order/components/checkout-summary';
import type { Discounts, Quote } from '../../cart-order/types';
import { promotionApi } from '../services/promotion-api';
import type { Promotion } from '../types';

export function promotionValue(promotion: Promotion) {
  return promotion.type === 'FIXED'
    ? money(promotion.value)
    : `${promotion.value}%${promotion.maxDiscount ? ` (tối đa ${money(promotion.maxDiscount)})` : ''}`;
}

/**
 * Ưu đãi & Điểm xanh. Mọi con số (giảm giá, điều kiện, số dư điểm) đều lấy từ POST /checkout/quote —
 * client không tự tính tiền. Mỗi đơn tối đa 1 voucher, có thể kết hợp Điểm xanh.
 */
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
  const ineligibleDialog = useRef<HTMLDialogElement>(null);
  const ineligibleShownFor = useRef<string | null>(null);
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
    ineligibleDialog.current?.close();
  };
  const validPoints = /^\d*$/.test(points) && Number(points) <= 2_147_483_647;

  // Voucher tồn tại nhưng tiền hàng chưa đủ mức tối thiểu (Figma Modal/Voucher/Ineligible)
  const ineligible =
    discounts.voucherCode && quote && !updating && quote.promotionShortfall > 0 ? quote : null;
  const ineligibleKey = ineligible ? `${discounts.voucherCode}|${ineligible.subtotal}` : null;
  useEffect(() => {
    if (ineligibleKey && ineligibleShownFor.current !== ineligibleKey) {
      ineligibleShownFor.current = ineligibleKey;
      ineligibleDialog.current?.showModal();
    }
  }, [ineligibleKey]);

  return (
    <section className={`${panel} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Ưu đãi xanh &amp; Điểm xanh</h2>
        {quote && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-900">
            Điểm xanh: {BigInt(quote.pointBalance).toLocaleString('vi-VN')}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-38 flex-1">
          <Input
            label="Mã voucher"
            value={code}
            maxLength={32}
            placeholder="VD: GREEN50"
            error={
              discounts.voucherCode && quote?.promotionError && !ineligible
                ? quote.promotionError
                : undefined
            }
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                applyVoucher(code);
              }
            }}
          />
        </div>
        <Button
          variant="outline"
          disabled={!code.trim() || updating}
          onClick={() => applyVoucher(code)}
        >
          {quote?.voucherCode && quote.voucherCode === code.trim().toUpperCase()
            ? 'Đã áp dụng'
            : 'Áp dụng'}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setOpen(true);
            dialog.current?.showModal();
          }}
        >
          Chọn voucher
        </Button>
      </div>
      {discounts.voucherCode && quote?.voucherCode && (
        <div className="flex items-start justify-between gap-3 text-sm">
          <p className="flex items-center gap-1 font-medium text-primary-900">
            <ShopIcon name="check" /> {quote.voucherCode} · Giảm {money(quote.voucherDiscount)}
            {quote.promotionMinSubtotal ? ` cho đơn từ ${money(quote.promotionMinSubtotal)}` : ''}
          </p>
          <button
            type="button"
            onClick={() => applyVoucher('')}
            className="shrink-0 font-medium text-primary-900 underline"
          >
            Bỏ voucher
          </button>
        </div>
      )}
      {ineligible && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          <div className="flex gap-2">
            <ShopIcon name="alert" />
            <div>
              <p className="font-semibold">
                Còn thiếu {money(ineligible.promotionShortfall)} tiền hàng
              </p>
              <p>
                {discounts.voucherCode} áp dụng cho tiền hàng từ{' '}
                {money(ineligible.promotionMinSubtotal ?? 0)}. Đơn hiện tại{' '}
                {money(ineligible.subtotal)} (chưa gồm phí giao).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => applyVoucher('')}
            className="shrink-0 font-medium underline"
          >
            Không dùng mã
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
            error={!validPoints ? 'Nhập số điểm nguyên hợp lệ.' : (quote?.pointsError ?? undefined)}
            hint={
              quote
                ? `1 điểm = ${money(quote.pointValue)} · Tối đa ${quote.pointLimit.toLocaleString('vi-VN')} điểm cho đơn này`
                : undefined
            }
            onChange={(event) => setPoints(event.target.value.trim())}
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
          disabled={!validPoints || !points || updating}
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
      {quote && quote.pointsUsed > 0 && (
        <p className="flex items-center gap-1 text-sm font-medium text-primary-900">
          <ShopIcon name="check" /> Dùng {quote.pointsUsed.toLocaleString('vi-VN')} điểm · Giảm{' '}
          {money(quote.pointDiscount)}
        </p>
      )}
      {updating && (
        <p role="status" className="text-sm text-gray-600">
          Đang cập nhật giá…
        </p>
      )}

      {/* Figma Overlay/VoucherPicker */}
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-labelledby="voucher-picker-title"
        className="m-auto max-h-[85vh] w-[min(92vw,35rem)] overflow-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl backdrop:bg-black/35"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 id="voucher-picker-title" className="text-lg font-semibold">
            Chọn voucher
          </h3>
          <button
            type="button"
            aria-label="Đóng"
            className="rounded-lg border border-gray-300 p-2"
            onClick={() => dialog.current?.close()}
          >
            <ShopIcon name="close" />
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          Mỗi đơn dùng tối đa một voucher cho tiền hàng, có thể kết hợp với Điểm xanh.
        </p>
        {promotions.isPending && <p role="status">Đang tải voucher…</p>}
        {promotions.data?.length === 0 && <p>Chưa có voucher đang áp dụng.</p>}
        <ErrorMessage error={promotions.error} />
        <ul className="space-y-2">
          {promotions.data?.map((promotion) => {
            const missing = quote
              ? Math.max(0, Number(promotion.minSubtotal) - Number(quote.subtotal))
              : 0;
            const selected = quote?.voucherCode === promotion.code;
            return (
              <li
                key={promotion.id}
                aria-current={selected || undefined}
                className={cn(
                  'flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm',
                  selected
                    ? 'border-primary-900 bg-primary-50'
                    : missing > 0
                      ? 'border-gray-200 bg-gray-50 text-gray-500'
                      : 'border-gray-200',
                )}
              >
                <div className="min-w-52 flex-1">
                  <p className={cn('font-semibold', !missing && 'text-gray-900')}>
                    {promotion.code} · Giảm {promotionValue(promotion)}
                  </p>
                  <p>
                    {promotion.name} · Đơn từ {money(promotion.minSubtotal)}
                  </p>
                  {missing > 0 && (
                    <p className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      Không đủ điều kiện · còn thiếu {money(missing)}
                    </p>
                  )}
                </div>
                {selected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-900 px-2.5 py-1 text-xs font-semibold text-white">
                    Đang chọn
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={missing > 0}
                    onClick={() => applyVoucher(promotion.code)}
                  >
                    Chọn
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </dialog>

      {/* Figma Modal/Voucher/Ineligible */}
      <dialog
        ref={ineligibleDialog}
        aria-labelledby="voucher-ineligible-title"
        className="m-auto w-[min(92vw,35rem)] rounded-2xl border border-gray-200 bg-white p-6 shadow-xl backdrop:bg-black/35"
      >
        {ineligible && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-primary-900">{discounts.voucherCode}</p>
                <h3 id="voucher-ineligible-title" className="text-xl font-bold">
                  Chưa đủ điều kiện dùng mã
                </h3>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                className="rounded-lg border border-gray-300 p-2"
                onClick={() => ineligibleDialog.current?.close()}
              >
                <ShopIcon name="close" />
              </button>
            </div>
            <div className="flex gap-3 rounded-lg bg-amber-100 p-4 text-amber-900">
              <ShopIcon name="alert" />
              <div>
                <p className="font-semibold">
                  Còn thiếu {money(ineligible.promotionShortfall)} tiền hàng
                </p>
                <p className="text-sm">
                  {discounts.voucherCode} chỉ áp dụng cho đơn có tiền hàng từ{' '}
                  {money(ineligible.promotionMinSubtotal ?? 0)}. Giỏ hiện có{' '}
                  {money(ineligible.subtotal)}, chưa gồm phí giao.
                </p>
              </div>
            </div>
            <div className="space-y-3 rounded-lg bg-gray-50 p-4 text-sm">
              <p className="font-semibold">Điều kiện của {discounts.voucherCode}</p>
              <dl className="space-y-3">
                {(
                  [
                    ['Mức tiền hàng tối thiểu', ineligible.promotionMinSubtotal ?? 0],
                    ['Tiền hàng hiện tại', ineligible.subtotal],
                    ['Cần thêm để đủ điều kiện', ineligible.promotionShortfall],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-gray-700">{label}</dt>
                    <dd className="tabular-nums">{money(value)}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t border-gray-200 pt-3">
                  <dt className="text-gray-700">Giảm giá đang áp dụng</dt>
                  <dd className="font-bold tabular-nums">{money(0)}</dd>
                </div>
              </dl>
            </div>
            <p className="text-sm text-gray-700">
              Chưa áp dụng mã và không đổi giỏ hàng. Bạn có thể tiếp tục không dùng mã hoặc chọn
              thêm sản phẩm nếu cần.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button variant="outline" size="lg" onClick={() => applyVoucher('')}>
                Không dùng mã
              </Button>
              <Link
                href="/products"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-primary-900 text-sm font-semibold text-white hover:bg-primary-800"
              >
                Tiếp tục mua sắm
              </Link>
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}
