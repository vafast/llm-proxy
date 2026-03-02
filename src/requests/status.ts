import { getAllProviders } from "../providers";
import { CustomOpenAI } from "../providers/custom-openai";
import { ProviderBase, ProviderNotSupportedError } from "../providers/provider";
import { Config } from "../utils/config";
import { Environments } from "../utils/environments";
import { Secrets } from "../utils/secrets";

/**
 * 脱敏 API Key，仅显示最后 3 位。
 */
function maskApiKey(key: string): string {
  if (key.length <= 3) {
    return "***";
  }
  return "*".repeat(Math.min(10, key.length - 3)) + key.slice(-3);
}

/**
 * 检查某 provider 某 API Key 的连通性。
 */
async function checkConnectivity(
  instance: ProviderBase,
  providerName: string,
  apiKeyIndex: number,
): Promise<"valid" | "invalid" | "unknown"> {
  if (!instance.modelsPath) {
    return "unknown";
  }

  try {
    const [requestInfo, requestInit] =
      await instance.buildModelsRequest(apiKeyIndex);

    const response = await instance.fetch(
      requestInfo,
      requestInit,
      apiKeyIndex,
    );

    if (response.ok) {
      return "valid";
    } else if (response.status === 401 || response.status === 403) {
      return "invalid";
    } else {
      return "unknown";
    }
  } catch (error) {
    if (error instanceof ProviderNotSupportedError) {
      return "unknown";
    }
    console.error(`Error checking connectivity for ${providerName}:`, error);
    return "invalid";
  }
}

export async function status() {
  const config = {
    DEV: Config.isDevelopment(),
    DEFAULT_MODEL: Config.defaultModel() || null,
    GLOBAL_ROUND_ROBIN: Config.isGlobalRoundRobinEnabled(),
  };

  const providersStatus: Record<string, any> = {};
  const env = Environments.all();
  const allProviders = getAllProviders(env);

  for (const [providerName, instance] of Object.entries(allProviders)) {
    let allKeys: string[] = [];

    if (instance instanceof CustomOpenAI) {
      allKeys = instance.getApiKeys();
    } else {
      const apiKeyName = instance.apiKeyName;
      if (apiKeyName) {
        allKeys = Secrets.getAll(apiKeyName);
      }
    }

    if (allKeys.length === 0) {
      providersStatus[providerName] = {
        available: instance.available(),
        keys: [],
      };
      continue;
    }
    const keyStatuses = await Promise.all(
      allKeys.map(async (_key, apiKeyIndex) => ({
        key: maskApiKey(_key),
        status: await checkConnectivity(
          instance,
          providerName,
          apiKeyIndex,
        ),
      })),
    );

    providersStatus[providerName] = {
      available: instance.available(),
      keys: keyStatuses,
    };
  }

  return {
    config,
    providers: providersStatus,
  };
}
