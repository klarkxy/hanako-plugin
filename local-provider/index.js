import { createLocalProviderMediaAdapter } from "./lib/media-adapter.js";
import {
  DEFAULT_LM_STUDIO_BASE_URL,
  getConfiguredMediaTypes,
  readRuntimeConfig,
  summarizeRuntimeConfig,
} from "./lib/runtime-store.js";

export default class LocalProviderPlugin {
  async onload() {
    const { bus, log } = this.ctx;
    let registeredTypes = [];

    const syncAdapter = async () => {
      const runtimes = await readRuntimeConfig(this.ctx);
      const nextTypes = getConfiguredMediaTypes(runtimes);
      const changed = nextTypes.join(",") !== registeredTypes.join(",");

      if (!changed) {
        return { types: nextTypes, runtimes };
      }

      if (registeredTypes.length > 0) {
        await bus.request("media-gen:unregister-adapter", { adapterId: "local-provider" }).catch(() => {});
      }

      registeredTypes = nextTypes;

      if (registeredTypes.length > 0) {
        const adapter = createLocalProviderMediaAdapter(this.ctx, registeredTypes);
        try {
          await bus.request("media-gen:register-adapter", { adapter });
          log.info(`registered local-provider adapter for: ${registeredTypes.join(", ")}`);
        } catch (error) {
          log.warn("failed to register local-provider adapter", error?.message || error);
        }
      }

      return { types: nextTypes, runtimes };
    };

    const getStatus = async ({ baseUrl } = {}) => {
      const runtimes = await readRuntimeConfig(this.ctx);
      const normalizedBaseUrl = String(baseUrl || DEFAULT_LM_STUDIO_BASE_URL).replace(/\/+$/, "");
      const status = {
        ok: false,
        baseUrl: normalizedBaseUrl,
        registeredMediaTypes: [...registeredTypes],
        runtimes: summarizeRuntimeConfig(runtimes),
        models: [],
        error: null,
      };

      try {
        const response = await fetch(`${normalizedBaseUrl}/models`, {
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          status.error = `HTTP ${response.status}`;
          return status;
        }

        const data = await response.json();
        const models = Array.isArray(data?.data) ? data.data : [];
        status.ok = true;
        status.models = models
          .map((item) => ({ id: item?.id || "", name: item?.id || "" }))
          .filter((item) => item.id);
        return status;
      } catch (error) {
        status.error = error?.message || String(error);
        return status;
      }
    };

    this.ctx._localProvider = { syncAdapter, getStatus };
    await syncAdapter();

    this.register(() => {
      bus.request("media-gen:unregister-adapter", { adapterId: "local-provider" }).catch(() => {});
    });
  }
}