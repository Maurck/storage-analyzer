import React, { lazy, Suspense } from "react";
import { Spinner } from "./shared/ui/Spinner";
import { QueryClient, QueryClientProvider } from "react-query";
import {
  LanguageProvider,
  useTranslation,
} from "./shared/i18n/LanguageProvider";

const client = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      cacheTime: 10 * 60 * 1000,
    },
  },
});

const StorageAnalysisPage = lazy(() =>
  import(
    /* webpackChunkName: "storage-workspace" */ "./features/storage-analysis/StorageAnalysisPage"
  ).then((module) => ({ default: module.StorageAnalysisPage })),
);

// Inside the provider so the loading label follows the chosen language.
function Loading() {
  const { t } = useTranslation();
  return (
    <div className="app-loading">
      <Spinner label={t("app.loading")} />
    </div>
  );
}

export const App = () => {
  return (
    <LanguageProvider>
      <QueryClientProvider client={client}>
        <Suspense fallback={<Loading />}>
          <StorageAnalysisPage />
        </Suspense>
      </QueryClientProvider>
    </LanguageProvider>
  );
};

export default App;
