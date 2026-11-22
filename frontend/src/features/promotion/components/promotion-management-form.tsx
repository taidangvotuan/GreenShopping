'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ErrorMessage } from '../../../shared/components/feedback/error-message';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { dateTime, money, panel } from '../../cart-order/components/checkout-summary';
import { StatusBadge } from '../../cart-order/components/order-status-timeline';
import { promotionApi } from '../services/promotion-api';
import type { Promotion, PromotionInput } from '../types';
import { promotionValue } from './promotion-code-input';

const manageKey = ['manage-promotions'];
const toLocalInput = (date: string) =>
  new Date(Date.parse(date) + 7 * 60 * 60_000).toISOString().slice(0, 16);

export function PromotionManagement() {
  const cache = useQueryClient();
  const [editing, setEditing] = useState<Promotion | 'new' | null>(null);
  const query = useQuery({ queryKey: manageKey, queryFn: promotionApi.manage });
  const refresh = () =>
    Promise.all([
      cache.invalidateQueries({ queryKey: manageKey }),
      cache.invalidateQueries({ queryKey: ['shopping', 'promotions'] }),
      cache.invalidateQueries({ queryKey: ['shopping', 'quote'] }),
    ]);

  return (
    <section className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Quản lý ưu đãi</h1>
          <p className="mt-1 text-sm text-gray-600">
            Voucher áp dụng cho tiền hàng trước phí giao và Điểm xanh.
          </p>
        </div>
        <Button className="bg-primary-900" onClick={() => setEditing('new')}>
          Thêm voucher
        </Button>
      </header>
      {editing && (
        <PromotionForm
          key={editing === 'new' ? 'new' : editing.id}
          promotion={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={async () => {
            await refresh();
            setEditing(null);
          }}
        />
      )}
      {query.isPending && <p role="status">Đang tải voucher…</p>}
      <ErrorMessage error={query.error} />
      {query.data?.length === 0 && <p>Chưa có voucher. Chọn “Thêm voucher” để bắt đầu.</p>}
      {!!query.data?.length && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[45rem] text-left text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                {[
                  'Voucher',
                  'Giá trị giảm',
                  'Đơn tối thiểu',
                  'Hiệu lực',
                  'Trạng thái',
                  'Thao tác',
                ].map((title) => (
                  <th key={title} scope="col" className="p-3">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data.map((promotion) => {
                const ended = Date.parse(promotion.endsAt) <= Date.now();
                const scheduled = Date.parse(promotion.startsAt) > Date.now();
                const active = promotion.active && !ended && !scheduled;
                const label = !promotion.active
                  ? 'Đã tắt'
                  : ended
                    ? 'Hết hạn'
                    : scheduled
                      ? 'Sắp áp dụng'
                      : 'Đang áp dụng';
                return (
                  <tr key={promotion.id} className="border-t border-gray-100">
                    <td className="p-3">
                      <strong>{promotion.code}</strong>
                      <p className="text-xs text-gray-600">{promotion.name}</p>
                    </td>
                    <td className="p-3">{promotionValue(promotion)}</td>
                    <td className="p-3">{money(promotion.minSubtotal)}</td>
                    <td className="p-3">
                      {dateTime(promotion.startsAt)}
                      <br />
                      đến {dateTime(promotion.endsAt)}
                    </td>
                    <td className="p-3">
                      <StatusBadge
                        label={label}
                        tone={
                          active ? 'green' : scheduled && promotion.active ? 'amber' : 'neutral'
                        }
                      />
                    </td>
                    <td className="p-3">
                      <Button variant="outline" size="sm" onClick={() => setEditing(promotion)}>
                        Chỉnh sửa
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PromotionForm({
  promotion,
  onClose,
  onSave,
}: {
  promotion?: Promotion;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const [type, setType] = useState<PromotionInput['type']>(promotion?.type ?? 'FIXED');
  const [validation, setValidation] = useState('');
  const save = useMutation({
    mutationFn: (data: PromotionInput) => promotionApi.save(data, promotion?.id),
    onSuccess: onSave,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const value = (name: string) => String(fields.get(name) ?? '').trim();
    const starts = new Date(`${value('startsAt')}+07:00`);
    const ends = new Date(`${value('endsAt')}+07:00`);
    if (!Number.isFinite(starts.getTime()) || !Number.isFinite(ends.getTime()) || ends <= starts) {
      setValidation('Thời điểm kết thúc phải sau thời điểm bắt đầu.');
      return;
    }
    setValidation('');
    save.mutate({
      code: value('code'),
      name: value('name'),
      type,
      value: Number(value('value')),
      minSubtotal: Number(value('minSubtotal')),
      maxDiscount: type === 'PERCENT' && value('maxDiscount') ? Number(value('maxDiscount')) : null,
      startsAt: starts.toISOString(),
      endsAt: ends.toISOString(),
      active: fields.has('active'),
    });
  }

  return (
    <form onSubmit={submit} className={`${panel} space-y-5`}>
      <h2 className="text-lg font-semibold">
        {promotion ? `Chỉnh sửa ${promotion.code}` : 'Thêm voucher'}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Input
          required
          label="Mã voucher"
          name="code"
          maxLength={32}
          defaultValue={promotion?.code}
        />
        <Input
          required
          label="Tên ưu đãi"
          name="name"
          minLength={2}
          maxLength={150}
          defaultValue={promotion?.name}
        />
        <label className="block space-y-1.5 text-sm font-medium">
          Loại voucher
          <select
            className="mt-1.5 block h-10 w-full rounded-lg border border-gray-300 bg-white px-3"
            value={type}
            onChange={(event) => setType(event.target.value as PromotionInput['type'])}
          >
            <option value="FIXED">Giảm số tiền cố định</option>
            <option value="PERCENT">Giảm phần trăm</option>
          </select>
        </label>
        <Input
          key={type}
          required
          label={type === 'FIXED' ? 'Số tiền giảm (₫)' : 'Phần trăm giảm'}
          type="number"
          name="value"
          min={1}
          max={type === 'FIXED' ? 999_999_999_999 : 100}
          defaultValue={promotion?.type === type ? promotion.value : undefined}
        />
        <Input
          required
          label="Tiền hàng tối thiểu (₫)"
          type="number"
          name="minSubtotal"
          min={0}
          max={999_999_999_999}
          defaultValue={promotion?.minSubtotal ?? '0'}
        />
        {type === 'PERCENT' && (
          <Input
            label="Mức giảm tối đa (₫)"
            type="number"
            name="maxDiscount"
            min={1}
            max={999_999_999_999}
            defaultValue={promotion?.maxDiscount ?? ''}
          />
        )}
        <Input
          required
          label="Bắt đầu (giờ Việt Nam)"
          name="startsAt"
          type="datetime-local"
          defaultValue={promotion && toLocalInput(promotion.startsAt)}
        />
        <Input
          required
          label="Kết thúc (giờ Việt Nam)"
          name="endsAt"
          type="datetime-local"
          defaultValue={promotion && toLocalInput(promotion.endsAt)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            className="size-4 accent-primary-800"
            type="checkbox"
            name="active"
            defaultChecked={promotion?.active ?? true}
          />{' '}
          Bật voucher
        </label>
      </div>
      {validation && (
        <p role="alert" className="text-sm text-red-700">
          {validation}
        </p>
      )}
      <ErrorMessage error={save.error} />
      <div className="flex gap-2">
        <Button type="submit" className="bg-primary-900" isLoading={save.isPending}>
          Lưu voucher
        </Button>
        <Button variant="outline" disabled={save.isPending} onClick={onClose}>
          Hủy
        </Button>
      </div>
    </form>
  );
}
