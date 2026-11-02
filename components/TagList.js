import Link from 'next/link';
import { investmentTags } from '@/lib/tags';

export default function TagList({ tags, hrefFor, className = '' }) {
  const list = investmentTags({ tags });
  if (!list.length) return null;
  return (
    <span className={`inline-flex flex-wrap gap-1 ${className}`}>
      {list.map((tag) => {
        const chip = 'inline-flex items-center text-[10px] leading-none px-1.5 py-0.5 rounded-full bg-plum-50 text-plum-600 border border-plum-600/30';
        if (hrefFor) {
          return (
            <Link key={tag.id} href={hrefFor(tag.name)} className={`${chip} hover:border-plum-600`}>
              {tag.name}
            </Link>
          );
        }
        return (
          <span key={tag.id} className={chip}>{tag.name}</span>
        );
      })}
    </span>
  );
}
