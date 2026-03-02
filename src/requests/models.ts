import { getAllProviders } from "../providers";
import { OpenAIModelsListResponseBody } from "../providers/openai/types";
import { ProviderNotSupportedError } from "../providers/provider";
import { Environments } from "../utils/environments";
import { withTimeout } from "../utils/helpers";
import { Secrets } from "../utils/secrets";

const PROVIDER_FETCH_TIMEOUT_MS = 5000;

export async function models(request: Request) {
  const contextApiKeyIndex = request.apiKeyIndex;

  const env = Environments.all();
  const allProviders = getAllProviders(env);
  const requests = Object.entries(allProviders).map(
    async ([providerName, providerInstance]) => {
      if (providerInstance.available() === false) {
        return {
          object: "list",
          data: [],
        } as OpenAIModelsListResponseBody;
      }

      const staticModels = providerInstance.staticModels();
      if (staticModels) {
        return staticModels;
      }

      const apiKeyIndex =
        contextApiKeyIndex !== undefined
          ? Secrets.resolveApiKeyIndex(
              contextApiKeyIndex,
              providerInstance.getApiKeys().length,
            )
          : 0;
      const [requestInfo, requestInit] =
        await providerInstance.buildModelsRequest(apiKeyIndex);

      const abortController = new AbortController();
      const fetchPromise = providerInstance
        .fetch(
          requestInfo,
          { ...requestInit, signal: abortController.signal },
          apiKeyIndex,
        )
        .then(async (response) => {
          const responseJson = await response.json();
          return providerInstance.modelsToOpenAIFormat(responseJson);
        });

      return withTimeout(
        fetchPromise,
        abortController,
        PROVIDER_FETCH_TIMEOUT_MS,
        providerName,
      );
    },
  );

  const responses = await Promise.allSettled(requests);
  const modelsList = responses.map((response, index) => {
    const provider = Object.keys(allProviders)[index];

    if (response.status === "rejected") {
      if (response.reason instanceof ProviderNotSupportedError) {
        return [];
      }

      console.error(
        `Error fetching models for provider ${provider}:`,
        response.reason,
      );
      return [];
    }
    if (
      response.status === "fulfilled" &&
      (!response.value || !response.value?.data)
    ) {
      console.error(
        `Invalid response for provider ${provider}:`,
        response.value,
      );
      return [];
    }

    const fulfilledResponse =
      response as PromiseFulfilledResult<OpenAIModelsListResponseBody>;
    return fulfilledResponse.value.data.map(({ id, ...model }) => ({
      id: `${provider}/${id}`,
      ...model,
    }));
  });

  return {
    data: modelsList.flat(),
    object: "list",
  };
}
