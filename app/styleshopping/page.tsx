import { StyleShopping } from "@/components/style/StyleShopping";
import { STYLE_CATALOG, STYLE_CATEGORIES } from "@/lib/style-catalog";
import { getCurrentUser } from "@/lib/projects";

export const metadata = {
  title: "เลือกสไตล์ให้เว็บคุณ — EasyGAS",
  description:
    "เดินเลือกองค์ประกอบหน้าตาเว็บแอป (เมนู ปุ่ม ป๊อปอัป ตาราง พร้อมเพย์ ฯลฯ) กดดูตัวอย่างได้ แล้วรวมเป็นคำสั่งให้ AI สร้างเครื่องมือบน Google Apps Script ให้ทันที",
};

// Public (browsable without login) — it doubles as an SEO/acquisition surface. Creating a project
// requires auth; the component routes to /login when the user isn't signed in.
export default async function StyleShoppingPage() {
  const user = await getCurrentUser();
  return (
    <StyleShopping catalog={STYLE_CATALOG} categories={STYLE_CATEGORIES} loggedIn={!!user} />
  );
}
