import Link from "next/link";

export function SectionHeading({ eyebrow, title, href, linkLabel, id }: { eyebrow?: string; title: string; href?: string; linkLabel?: string; id?: string }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4 sm:mb-10">
      <div>
        {eyebrow ? <p className="eyebrow text-gold-deep">{eyebrow}</p> : null}
        <h2 id={id} className="mt-2 text-3xl sm:text-4xl">
          {title}
        </h2>
      </div>
      {href ? (
        <Link href={href} className="shrink-0 border-b border-charcoal pb-0.5 text-sm hover:border-gold-deep hover:text-gold-deep">
          {linkLabel ?? "View all"}
        </Link>
      ) : null}
    </div>
  );
}
