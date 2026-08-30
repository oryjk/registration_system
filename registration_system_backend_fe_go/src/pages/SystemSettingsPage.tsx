import { ErrorAlert } from "@/components/admin/error-alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  useMiniAppSettingsQuery,
  useUpdateMiniAppSettingsMutation,
} from "@/hooks/queries/useSystemQueries";

export default function SystemSettingsPage() {
  const settings = useMiniAppSettingsQuery();
  const updateSettings = useUpdateMiniAppSettingsMutation();
  const busy = settings.isLoading || updateSettings.isPending;

  const clearProfileEnabled =
    settings.data?.debug.clear_profile_enabled ?? false;
  const reviewToggleEnabled =
    settings.data?.debug.review_status_toggle_enabled ?? false;

  return (
    <div className="content-grid">
      <Card>
        <CardHeader>
          <CardTitle>系统设置</CardTitle>
          <CardDescription>小程序运行时配置</CardDescription>
        </CardHeader>
        <CardContent className="settings-stack">
          <section className="setting-row">
            <div className="setting-row-head">
              <Switch
                aria-label="小程序验证入口"
                checked={clearProfileEnabled}
                disabled={busy}
                onCheckedChange={(enabled) =>
                  updateSettings.mutate({
                    debug: { clear_profile_enabled: enabled },
                  })
                }
              />
              <strong>小程序验证入口</strong>
              <span className="cell-secondary">
                {clearProfileEnabled ? "已开启" : "已关闭"}
              </span>
            </div>
            <p className="setting-row-description">
              开启后，小程序「我的」页会出现「清除头像和昵称」的验证入口，
              用于模拟新用户未完善资料的状态；默认关闭，验证完成后请关闭。
            </p>
          </section>

          <section className="setting-row">
            <div className="setting-row-head">
              <Switch
                aria-label="审核状态切换入口"
                checked={reviewToggleEnabled}
                disabled={busy}
                onCheckedChange={(enabled) =>
                  updateSettings.mutate({
                    debug: { review_status_toggle_enabled: enabled },
                  })
                }
              />
              <strong>审核状态切换入口</strong>
              <span className="cell-secondary">
                {reviewToggleEnabled ? "已开启" : "已关闭"}
              </span>
            </div>
            <p className="setting-row-description">
              开启后，白名单用户（后端 MINI_REVIEW_CONTROL_USER_IDS
              配置）在小程序「我的」页
              可切换当前版本的审核状态，用于提审/过审时的入口显隐验证；默认关闭。
            </p>
          </section>

          {settings.isError ? (
            <ErrorAlert
              message="小程序配置加载失败"
              onRetry={() => void settings.refetch()}
            />
          ) : null}
          {updateSettings.isError ? (
            <ErrorAlert message="小程序配置保存失败" />
          ) : null}
          {updateSettings.isSuccess ? (
            <div className="alert alert-success" role="status">
              <div className="alert-body">
                <strong>小程序配置已保存</strong>
                <span>
                  小程序端下次拉取运行配置后生效（进入「我的」页即刷新）。
                </span>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
