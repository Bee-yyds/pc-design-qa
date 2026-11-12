import type { Metadata } from "next";
import { project } from "@/lib/report";
import "./globals.css";

export const metadata:Metadata = {title: project.requirement + " · 视觉验收",description:project.version + " 视觉问题协作与修复确认"};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){
  return <html lang="zh-CN"><body>{children}</body></html>;
}
