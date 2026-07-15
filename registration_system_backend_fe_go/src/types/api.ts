export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface HealthStatus {
  status: "ok";
}
