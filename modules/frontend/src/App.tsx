import React, { lazy, Suspense } from "react";
import { Spinner } from "./shared/ui/Spinner";
import { QueryClient, QueryClientProvider } from "react-query";

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

export const App = () => {
  return (
    <QueryClientProvider client={client}>
      <Suspense
        fallback={
          <div className="app-loading">
            <Spinner label="Opening Storage Analyzer" />
          </div>
        }
      >
        <StorageAnalysisPage />
      </Suspense>
    </QueryClientProvider>
  );
};

export default App;
