import Image from 'next/image';

const sizes = {
  brand: 32,
  cart: 20,
  search: 20,
  user: 20,
  minus: 44,
  plus: 44,
  trash: 16,
  shield: 20,
  close: 20,
  check: 14,
  alert: 24,
  truck: 14,
  package: 24,
  pin: 20,
};

export function ShopIcon({ name }: { name: keyof typeof sizes }) {
  return (
    <Image
      src={`/shopping/${name}.svg`}
      alt=""
      width={sizes[name]}
      height={sizes[name]}
      className="shrink-0"
      unoptimized
    />
  );
}
