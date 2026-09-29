import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { installMonitoring } from "./app/lib/logger";
import "./styles/index.css";

// Bật thu thập lỗi chưa bắt được + Core Web Vitals trước khi render
installMonitoring();

createRoot(document.getElementById("root")!).render(<App />);
