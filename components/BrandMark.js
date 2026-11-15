/** The ₹ brand mark with its shine animation, used on every page. */
const SIZES = {
  sm: 'w-8 h-8 rounded-lg text-xs',
  md: 'w-9 h-9 rounded-xl text-sm',
  lg: 'w-12 h-12 rounded-2xl text-lg',
};

export default function BrandMark({ size = 'md', className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`brand-mark ${SIZES[size] || SIZES.md} bg-ink text-paper inline-flex items-center justify-center font-semibold flex-shrink-0 ${className}`}
    >
      ₹
    </span>
  );
}
