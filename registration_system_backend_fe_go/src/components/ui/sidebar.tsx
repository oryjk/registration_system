import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export const SidebarProvider = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("sidebar-provider", className)} {...props} />
));
SidebarProvider.displayName = "SidebarProvider";

export const Sidebar = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <aside ref={ref} className={cn("sidebar", className)} {...props} />
  ),
);
Sidebar.displayName = "Sidebar";

export const SidebarHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("sidebar-header", className)} {...props} />
));
SidebarHeader.displayName = "SidebarHeader";

export const SidebarContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("sidebar-content", className)} {...props} />
));
SidebarContent.displayName = "SidebarContent";

export const SidebarGroup = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("sidebar-group", className)} {...props} />
));
SidebarGroup.displayName = "SidebarGroup";

export const SidebarGroupLabel = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("sidebar-group-label", className)} {...props} />
));
SidebarGroupLabel.displayName = "SidebarGroupLabel";

export const SidebarMenu = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("sidebar-menu", className)} {...props} />
));
SidebarMenu.displayName = "SidebarMenu";

export const SidebarMenuItem = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("sidebar-menu-item", className)} {...props} />
));
SidebarMenuItem.displayName = "SidebarMenuItem";
