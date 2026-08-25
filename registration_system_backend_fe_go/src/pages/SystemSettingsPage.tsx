import { SettingOutlined } from "@ant-design/icons";
import { PageContainer } from "@ant-design/pro-components/es/layout/components/PageContainer";
import { Alert, Space, Switch, Typography } from "antd";
import {
  useMiniAppSettingsQuery,
  useUpdateMiniAppSettingsMutation,
} from "../hooks/queries/useSystemQueries";

const { Text, Paragraph } = Typography;

export default function SystemSettingsPage() {
  const settings = useMiniAppSettingsQuery();
  const updateSettings = useUpdateMiniAppSettingsMutation();

  const clearProfileEnabled =
    settings.data?.debug.clear_profile_enabled ?? false;
  const reviewToggleEnabled =
    settings.data?.debug.review_status_toggle_enabled ?? false;

  const toggleClearProfile = (enabled: boolean) => {
    updateSettings.mutate({ debug: { clear_profile_enabled: enabled } });
  };

  const toggleReviewStatus = (enabled: boolean) => {
    updateSettings.mutate({ debug: { review_status_toggle_enabled: enabled } });
  };

  return (
    <PageContainer
      title="系统设置"
      content="小程序运行时配置"
      extra={<SettingOutlined className="page-container-icon" />}
    >
      <section className="data-panel">
        <Space align="center" size={12}>
          <Switch
            checked={clearProfileEnabled}
            loading={settings.isLoading || updateSettings.isPending}
            onChange={toggleClearProfile}
          />
          <Text strong>小程序验证入口</Text>
          <Text type="secondary">
            {clearProfileEnabled ? "已开启" : "已关闭"}
          </Text>
        </Space>
        <Paragraph
          type="secondary"
          style={{ marginTop: 12, marginBottom: 0, maxWidth: 640 }}
        >
          开启后，小程序「我的」页会出现「清除头像和昵称」的验证入口，
          用于模拟新用户未完善资料的状态；默认关闭，验证完成后请关闭。
        </Paragraph>
      </section>

      <section className="data-panel" style={{ marginTop: 16 }}>
        <Space align="center" size={12}>
          <Switch
            checked={reviewToggleEnabled}
            loading={settings.isLoading || updateSettings.isPending}
            onChange={toggleReviewStatus}
          />
          <Text strong>审核状态切换入口</Text>
          <Text type="secondary">
            {reviewToggleEnabled ? "已开启" : "已关闭"}
          </Text>
        </Space>
        <Paragraph
          type="secondary"
          style={{ marginTop: 12, marginBottom: 0, maxWidth: 640 }}
        >
          开启后，白名单用户（后端 MINI_REVIEW_CONTROL_USER_IDS
          配置）在小程序「我的」页
          可切换当前版本的审核状态，用于提审/过审时的入口显隐验证；默认关闭。
        </Paragraph>
      </section>

      {settings.isError && (
        <Alert
          type="error"
          showIcon
          message="小程序配置加载失败"
          description={
            settings.error instanceof Error
              ? settings.error.message
              : "请稍后重试"
          }
          style={{ marginTop: 16 }}
        />
      )}
      {updateSettings.isError && (
        <Alert
          type="error"
          showIcon
          message="小程序配置保存失败"
          description={
            updateSettings.error instanceof Error
              ? updateSettings.error.message
              : "请稍后重试"
          }
          style={{ marginTop: 16 }}
        />
      )}
      {updateSettings.isSuccess && (
        <Alert
          type="success"
          showIcon
          message="小程序配置已保存"
          description={
            <Text type="secondary">
              小程序端下次拉取运行配置后生效（进入「我的」页即刷新）。
            </Text>
          }
          style={{ marginTop: 16 }}
        />
      )}
    </PageContainer>
  );
}
