<script setup lang="ts">
import { onLaunch } from "@dcloudio/uni-app";
import { restoreSession } from "@/stores/session";

onLaunch(() => {
  void restoreSession();
});
</script>

<style lang="scss">
@import "./styles/global.scss";
</style>
