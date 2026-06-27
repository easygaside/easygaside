"use client";

import { useState } from "react";
import Image from "next/image";

const FACEBOOK_URL = "https://www.facebook.com/share/p/1BJtec6HzY/";
const REVIEW_IMAGE = "https://qimwyprjnlejefeukuuy.supabase.co/storage/v1/object/public/tr/review.png";

export function FeedbackCard() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <a
      href={FACEBOOK_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative overflow-hidden rounded-2xl border border-white/70 dark:border-slate-700/60 bg-white dark:bg-slate-900 shadow-[0_8px_24px_rgba(60,70,110,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(60,70,110,0.13)]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* accent = orange for feedback */}
      <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-400 to-pink-500 z-20" />

      <div className="relative aspect-[16/10] w-full">
        <Image
          src={REVIEW_IMAGE}
          alt="รีวิว"
          fill
          className="object-cover transition-opacity duration-300"
        />

        {/* hover overlay text */}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-white/95 dark:bg-slate-900/95 transition-opacity duration-300 ${
            isHovered ? "opacity-100" : "opacity-0"
          }`}
        >
          <p className="px-4 text-center text-sm font-semibold leading-relaxed text-slate-700 dark:text-slate-200">
            บอกกับเราเกี่ยวกับ<br />ประสบการณ์การใช้งาน
          </p>
        </div>
      </div>
    </a>
  );
}
