import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { router } from "@/router";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("未找到 #root 挂载节点");

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
    <Toaster />
  </StrictMode>,
);
