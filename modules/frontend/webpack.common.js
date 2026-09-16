const path = require("path");

module.exports = (_environment, argv = {}) => {
  const development = argv.mode === "development";
  return {
    mode: development ? "development" : "production",
    context: __dirname,
    entry: "./src/main.tsx",
    devtool: development ? "source-map" : false,
    // The renderer uses the narrow preload bridge, never Node.js APIs.
    target: "web",
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
        {
          test: /\.css$/i,
          use: ["style-loader", "css-loader"],
        },
      ],
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
    },
    output: {
      filename: "app.js",
      path: path.resolve(__dirname, "build"),
      clean: true,
    },
  };
};
