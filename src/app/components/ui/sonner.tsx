"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

/**
 * TOASTER DÙNG CHUNG
 *
 * Cấu hình theo chuẩn các dashboard hiện đại (Linear, Vercel, Stripe):
 *  - position "bottom-right": không bao giờ che thanh tiêu đề & nút hành động ở đầu trang
 *  - expand: nhiều thông báo sẽ DÀN DỌC, mỗi cái một dòng, không chồng đè lên nhau
 *  - gap 12px: khoảng cách rõ ràng giữa các thông báo
 *  - visibleToasts 4: hiển thị tối đa 4 cái cùng lúc, cái cũ nhất tự rời đi
 *  - duration 3500ms: tự biến mất sau 3,5 giây (di chuột vào sẽ tạm dừng đếm giờ)
 *  - closeButton: người dùng có thể tắt ngay lập tức bằng tay
 *  - pauseWhenPageIsHidden: chuyển tab thì dừng đếm, quay lại vẫn kịp đọc
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      expand
      gap={12}
      visibleToasts={4}
      duration={3500}
      closeButton
      richColors
      toastOptions={{
        duration: 3500,
        classNames: {
          toast: "rounded-xl border shadow-lg",
          title: "text-sm font-medium",
          description: "text-xs opacity-80",
          closeButton: "opacity-70 hover:opacity-100",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
