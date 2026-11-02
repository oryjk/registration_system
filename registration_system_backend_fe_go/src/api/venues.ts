import type { VenueItem } from "../types/venue";
import { request } from "./client";

export function listVenues() {
  return request<VenueItem[]>("/venues");
}

export function uploadVenueImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return request<{ image_url: string }>("/venues/images", {
    method: "POST",
    body: formData,
  });
}

export function setVenueImage(location: string, imageUrl: string) {
  return request<{ location: string; image_url: string }>("/venues/image", {
    method: "PUT",
    body: JSON.stringify({ location, image_url: imageUrl }),
  });
}
