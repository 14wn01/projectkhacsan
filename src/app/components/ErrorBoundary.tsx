import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { logger } from "../lib/logger";
import { Button } from "./ui/button";

interface Props {
  children: ReactNode;
  /** Tên khu vực để log biết lỗi ở đâu */
  scope?: string;
  /** Nội dung thay thế tùy chỉnh */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
  info: string;
}

/**
 * Chặn lỗi render để 1 trang hỏng không làm trắng toàn bộ app.
 *
 * Quan trọng trong vận hành: lễ tân đang check-in cho khách thì không được
 * phép màn hình trắng — phải có thông điệp rõ và nút thủ tục dự phòng.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: "" };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error(this.props.scope ?? "ui", error.message, {
      stack: error.stack,
      componentStack: info.componentStack,
    });
    this.setState({ info: info.componentStack ?? "" });
  }

  private reset = () => this.setState({ error: null, info: "" });

  private copyDetails = async () => {
    const text = [
      `Lỗi: ${this.state.error?.message}`,
      `Khu vực: ${this.props.scope ?? "ui"}`,
      `Thời điểm: ${new Date().toLocaleString("vi-VN")}`,
      `Trình duyệt: ${navigator.userAgent}`,
      "",
      this.state.error?.stack ?? "",
      this.state.info,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Trình duyệt chặn clipboard — không sao, vẫn hiển thị bên dưới
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="grid place-items-center p-6">
        <div className="w-full max-w-xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600">
              <AlertTriangle className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold">Mục này đang gặp sự cố</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Các phần khác của hệ thống vẫn hoạt động bình thường. Dữ liệu đã lưu không bị mất.
              </p>

              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs">
                <div className="font-medium text-slate-700">Nếu đang phục vụ khách, làm ngay:</div>
                <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-slate-600">
                  <li>Bấm “Thử lại” — phần lớn lỗi tạm thời sẽ hết.</li>
                  <li>Nếu vẫn lỗi, ghi tay thông tin khách vào sổ và nhập lại sau.</li>
                  <li>Bấm “Copy chi tiết lỗi” rồi gửi cho bộ phận kỹ thuật.</li>
                </ol>
              </div>

              <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
                {this.state.error.message}
              </pre>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={this.reset}>
                  <RefreshCw className="size-4" /> Thử lại
                </Button>
                <Button size="sm" variant="outline" onClick={this.copyDetails}>
                  Copy chi tiết lỗi
                </Button>
                <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>
                  Tải lại trang
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
