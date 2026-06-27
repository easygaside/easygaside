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
      className="group relative overflow-hidden rounded-2xl border border-white/70 dark:border-slate-700/60 bg-white dark:bg-slate-900 p-5 shadow-[0_8px_24px_rgba(60,70,110,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(60,70,110,0.13)]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* accent = orange for feedback */}
      <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-400 to-pink-500" />

      <div className="relative h-full min-h-[140px]">
        <Image
          src={REVIEW_IMAGE}
          alt="รีวิว"
          fill
          className={`rounded-xl object-contain transition-opacity duration-300 ${
            isHovered ? "opacity-20" : "opacity-100"
          }`}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />

        {/* hover overlay text */}
        <div
          className={`absolute inset-0 flex items-center justify-center rounded-xl bg-white/90 dark:bg-slate-900/90 transition-opacity duration-300 ${
            isHovered ? "opacity-100" : "opacity-0"
          }`}
        >
          <p className="px-4 text-center text-sm font-semibold leading-relaxed text-slate-700 dark:text-slate-200">
            บอกกับเราเกี่ยวกับ<br />ประสบการณ์การใช้งาน
          </p>
        </div>
      </div>

      {/* external link indicator */}
      <div className="mt-3 flex items-center justify-center gap-1 text-[10px] font-medium text-slate-400 dark:text-slate-500">
        <span>คลิกเพื่อแสดงความคิดเห็น</span>
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </div>
    </a>
  );
}
