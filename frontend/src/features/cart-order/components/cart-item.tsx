import Link from 'next/link';
import { ShopIcon } from '../../../shared/components/ui/shop-icon';
import type { CartItem } from '../types';
import { money } from './checkout-summary';

export function QuantityPicker({
  quantity,
  max,
  disabled,
  onChange,
}: {
  quantity: number;
  max: number;
  disabled?: boolean;
  onChange: (quantity: number) => void;
}) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-lg border border-gray-300 bg-white">
      <button
        type="button"
        aria-label="Giảm số lượng"
        disabled={disabled || quantity <= 1 || max < 1}
        className="hover:bg-primary-50 disabled:opacity-40"
        onClick={() => onChange(Math.min(quantity - 1, max))}
      >
        <ShopIcon name="minus" />
      </button>
      <output className="min-w-8 text-center text-sm tabular-nums" aria-label="Số lượng">
        {quantity}
      </output>
      <button
        type="button"
        aria-label="Tăng số lượng"
        disabled={disabled || quantity >= max}
        className="hover:bg-primary-50 disabled:opacity-40"
        onClick={() => onChange(quantity + 1)}
      >
        <ShopIcon name="plus" />
      </button>
    </div>
  );
}

export function CartItemRow({
  item,
  selected,
  disabled,
  onSelect,
  onQuantity,
  onRemove,
}: {
  item: CartItem;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const { product, quantity } = item;
  const available = product.active && product.shop.active;
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 py-4">
      <input
        type="checkbox"
        className="size-4 accent-primary-800"
        aria-label={`Chọn ${product.name}`}
        checked={selected}
        disabled={disabled || !available || quantity > product.stock}
        onChange={onSelect}
      />
      {product.imageUrl && (
        <img src={product.imageUrl} alt="" className="size-18 rounded-lg object-cover" />
      )}
      <div className="min-w-34 flex-1">
        <Link href={`/products/${product.id}`} className="font-semibold hover:text-primary-800">
          {product.name}
        </Link>
        <p className="mt-1 text-sm text-gray-600">{money(product.price)} / sản phẩm</p>
        {(!available || quantity > product.stock) && (
          <p className="text-sm text-red-700">
            {available ? `Còn ${product.stock} sản phẩm` : 'Đã ngừng bán'}
          </p>
        )}
      </div>
      <div className="ml-auto space-y-1 text-right">
        <QuantityPicker
          quantity={quantity}
          max={Math.min(99, product.stock)}
          disabled={disabled || !available}
          onChange={onQuantity}
        />
        <p className="font-semibold">{money(Number(product.price) * quantity)}</p>
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          className="ml-auto flex items-center gap-1 text-xs text-gray-600 hover:text-red-700"
        >
          <ShopIcon name="trash" /> Xóa
        </button>
      </div>
    </div>
  );
}
