"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDown } from "lucide-react";
import { config } from "@/lib/config";

export function HomeHero() {
  return (
    <section
      id="home"
      className="relative isolate mx-3 mt-3 min-h-[34vh] overflow-hidden rounded-[1.75rem] bg-brand-900 text-white sm:mx-4 sm:min-h-[36vh] sm:rounded-[2rem]"
    >
      <Image
        src="/images/hero-banner.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center animate-hero-zoom"
      />
      <div
        className="absolute inset-0 bg-linear-to-t from-brand-900 via-brand-900/70 to-brand-900/25"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-linear-to-l from-transparent via-brand-900/15 to-brand-900/65"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-[34vh] max-w-5xl flex-col justify-end px-5 pb-7 pt-10 sm:min-h-[36vh] sm:justify-center sm:px-8 sm:pb-10 sm:pt-12">
        <div className="max-w-xl animate-hero-rise">
          <p className="font-display text-3xl font-extrabold tracking-tight text-brand-500 sm:text-4xl md:text-5xl">
            {config.appName}
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold leading-tight text-white sm:mt-3 sm:text-3xl md:text-4xl">
            طعام أصيل
            <span className="text-brand-500"> بمذاق أفضل</span>
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-stone-200 sm:mt-3 sm:text-base">
            مكونات طازجة ومأكولات شامية أصيلة — اطلب من فرعك الأقرب بسهولة.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-5">
            <Link
              href="#locations"
              className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-bold text-brand-900 transition hover:bg-brand-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-900"
            >
              اطلب الآن
              <ArrowDown className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
