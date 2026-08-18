import { SettingOutlined } from "@ant-design/icons";
import { PageContainer } from "@ant-design/pro-components/es/layout/components/PageContainer";
import { Alert, Descriptions, Switch, Typography } from "antd";
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

  const toggleClearProfile = (enabled: boolean) => {
    updateSettings.mutate({ debug: { clear_profile_enabled: enabled } });
  };

  return (
    <PageContainer
      title="系统设置"
      content="小程序运行时配置"
      extra={<SettingOutlined className="page-container-icon" />}
    >
      <section className="data-panel">
        <Descriptions column={1} colon={false}>
          <Descriptions.Item label="小程序验证入口">
            <Switch
              checked={clearProfileEnabled}
              loading={settings.isLoading || updateSettings.isPending}
              onChange={toggleClearProfile}
            />
            <Paragraph
              type="secondary"
              style={{ marginTop: 12, marginBottom: 0 }}
            >
              开启后，小程序「我的」页会出现「清除头像和昵称」的验证入口，
              用于模拟新用户未完善资料的状态；默认关闭，验证完成后请关闭。
            </Paragraph>
          </Descriptions.Item>
        </Descriptions>
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
