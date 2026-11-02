import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { ErrorAlert } from "@/components/admin/error-alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useVenuesQuery } from "@/hooks/queries/useVenueQueries";
import { VenueImageCell } from "@/pages/venues/VenueImageCell";
import type { VenueItem } from "@/types/venue";
import { formatNumericDateTime } from "@/utils/format";

const columns: DataTableColumn<VenueItem>[] = [
  { key: "location", title: "球场名称", width: 220 },
  {
    key: "image_url",
    title: "球场图片",
    width: 330,
    render: (venue) => <VenueImageCell venue={venue} />,
  },
  {
    key: "coordinates",
    title: "定位坐标",
    width: 210,
    render: (venue) =>
      venue.latitude !== null && venue.longitude !== null
        ? `${venue.latitude.toFixed(6)}, ${venue.longitude.toFixed(6)}`
        : "-",
  },
  { key: "use_count", title: "使用次数", width: 100, align: "right" },
  {
    key: "last_used_at",
    title: "最近使用",
    width: 180,
    render: (venue) => formatNumericDateTime(venue.last_used_at),
  },
];

export default function VenueListPage() {
  const venues = useVenuesQuery();
  const error = venues.error instanceof Error ? venues.error.message : "";

  return (
    <div className="content-grid">
      <Card>
        <CardHeader>
          <CardTitle>球场管理</CardTitle>
          <CardDescription>
            为已定位球场配置一张展示图片；微信用户选中球场后可查看缩略图并放大。
          </CardDescription>
        </CardHeader>
        <CardContent className="table-card-content">
          {error ? (
            <ErrorAlert
              message={error}
              onRetry={venues.isError ? () => void venues.refetch() : undefined}
            />
          ) : null}
          <DataTable
            columns={columns}
            emptyText="暂无已定位球场"
            items={venues.data}
            loading={venues.isFetching}
            rowKey={(venue) => venue.location}
            scrollable
          />
        </CardContent>
      </Card>
    </div>
  );
}
