"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { CategoryNode } from "@/server/catalog";
import { cn } from "@/lib/cn";

function Icon({ path, className }: { path: string; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} className={cn("size-5", className)}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

const ICONS = {
  search: "M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z",
  bag: "M6 7h12l1 13H5L6 7Zm3 0V5.5a3 3 0 0 1 6 0V7",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
};

export function SiteHeader({
  storeName,
  logoUrl,
  categories,
  cartCount,
}: {
  storeName: string;
  logoUrl: string | null;
  categories: CategoryNode[];
  cartCount: number;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const menuId = useId();
  const searchId = useId();

  // Close the menu and search after navigation (state adjusted during render, not in an effect).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMenuOpen(false);
    setSearchOpen(false);
  }

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!menuOpen && !searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setSearchOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen, searchOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ivory/95 backdrop-blur supports-[backdrop-filter]:bg-ivory/85">
      <div className="container-page flex h-16 items-center gap-4 lg:h-20">
        <button
          type="button"
          className="-ml-2 p-2 lg:hidden"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <Icon path={menuOpen ? ICONS.close : ICONS.menu} />
          <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
        </button>

        <Link href="/" className="flex items-center gap-3 lg:mr-8" aria-label={`${storeName} home`}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-9 w-auto lg:h-11" />
          ) : (
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-full border border-gold text-gold-deep font-display text-lg lg:size-10">
              {storeName.charAt(0)}
            </span>
          )}
          <span className="font-display text-xl tracking-wide sm:text-2xl">{storeName}</span>
        </Link>

        <nav aria-label="Main" className="hidden flex-1 lg:block">
          <ul className="flex items-center gap-7 text-sm">
            <li>
              <Link href="/shop" className="link-underline py-2 hover:text-gold-deep" aria-current={pathname === "/shop" ? "page" : undefined}>
                Shop all
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.id} className="group relative">
                <Link
                  href={`/category/${c.slug}`}
                  className="py-2 hover:text-gold-deep"
                  aria-current={pathname === `/category/${c.slug}` ? "page" : undefined}
                >
                  {c.name}
                </Link>
                {c.children.length ? (
                  <ul className="invisible absolute left-0 top-full z-50 min-w-48 border border-line bg-ivory py-2 opacity-0 shadow-sm transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    {c.children.map((ch) => (
                      <li key={ch.id}>
                        <Link href={`/category/${ch.slug}`} className="block px-4 py-2 hover:bg-cream">
                          {ch.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="p-2 hover:text-gold-deep"
            aria-expanded={searchOpen}
            aria-controls={searchId}
            onClick={() => setSearchOpen((v) => !v)}
          >
            <Icon path={ICONS.search} />
            <span className="sr-only">Search</span>
          </button>
          <Link href="/cart" className="relative p-2 hover:text-gold-deep" data-testid="cart-link">
            <Icon path={ICONS.bag} />
            <span className="sr-only">Shopping bag, {cartCount} {cartCount === 1 ? "item" : "items"}</span>
            {cartCount > 0 ? (
              <span aria-hidden="true" data-testid="cart-count" className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-gold-deep px-1 text-[0.68rem] leading-5 text-ivory">
                {cartCount}
              </span>
            ) : null}
          </Link>
        </div>
      </div>

      <div id={searchId} hidden={!searchOpen} className="border-t border-line bg-ivory">
        <form
          role="search"
          className="container-page flex gap-2 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            const q = searchRef.current?.value.trim();
            router.push(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
          }}
        >
          <label htmlFor={`${searchId}-input`} className="sr-only">
            Search products
          </label>
          <input
            ref={searchRef}
            id={`${searchId}-input`}
            type="search"
            name="q"
            placeholder="Search shawls, curtains, earrings…"
            className="w-full border-b border-charcoal bg-transparent py-2 text-lg outline-none placeholder:text-stone/70 focus-visible:outline-none"
            maxLength={100}
          />
          <button type="submit" className="px-4 text-sm font-medium tracking-wide hover:text-gold-deep">
            Search
          </button>
        </form>
      </div>

      <div id={menuId} hidden={!menuOpen} className="border-t border-line bg-ivory lg:hidden">
        <nav aria-label="Mobile" className="container-page max-h-[70vh] overflow-y-auto py-4">
          <ul className="divide-y divide-line">
            <li>
              <Link href="/shop" className="block py-3 font-display text-xl">
                Shop all
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.id} className="py-3">
                <Link href={`/category/${c.slug}`} className="block font-display text-xl">
                  {c.name}
                </Link>
                {c.children.length ? (
                  <ul className="mt-2 space-y-2 pl-4 text-sm text-stone">
                    {c.children.map((ch) => (
                      <li key={ch.id}>
                        <Link href={`/category/${ch.slug}`}>{ch.name}</Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
