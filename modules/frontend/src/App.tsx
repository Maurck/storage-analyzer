import React from "react";
import LayoutComponent from "./components/LayoutComponent";
import { QueryClient, QueryClientProvider } from "react-query";

const client = new QueryClient();

export const App = () => {
    return (
        <QueryClientProvider client={client}>
            <LayoutComponent />
        </QueryClientProvider>
    );
}

export default App;
