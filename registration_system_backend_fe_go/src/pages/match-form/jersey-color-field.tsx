// 常用球服颜色预设，主/客队颜色选择共用。
const JERSEY_COLOR_PRESETS = [
  "#FFFFFF",
  "#FF0000",
  "#2F6BFF",
  "#111310",
  "#C8FF00",
  "#FF6B35",
  "#B34DFF",
  "#D8DDE6",
];

interface JerseyColorFieldProps {
  id?: string;
  value?: string;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
  "aria-label"?: string;
}

/** ColorPicker(showText + presets) 的等价物：预设色板 + 原生取色器 + hex 展示。 */
export function JerseyColorField({
  id,
  value,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: JerseyColorFieldProps) {
  const current = value ?? "";

  return (
    <div className="jersey-color-field" id={id}>
      <fieldset className="jersey-color-presets">
        {JERSEY_COLOR_PRESETS.map((preset) => (
          <button
            aria-label={`选择颜色 ${preset}`}
            aria-pressed={current.toLowerCase() === preset.toLowerCase()}
            className="jersey-color-preset"
            data-active={current.toLowerCase() === preset.toLowerCase()}
            disabled={disabled}
            key={preset}
            onClick={() => onChange(preset)}
            style={{ background: preset }}
            type="button"
          />
        ))}
      </fieldset>
      <label className="jersey-color-custom">
        <input
          aria-label={ariaLabel ? `${ariaLabel}自定义` : "自定义颜色"}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(current) ? current : "#FFFFFF"}
        />
        <code>{current || "未设置"}</code>
      </label>
    </div>
  );
}
