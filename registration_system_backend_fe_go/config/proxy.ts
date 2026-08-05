const proxy = {
  dev: {
    "/go-api": {
      changeOrigin: true,
      pathRewrite: { "^/go-api": "" },
      target: process.env.API_PROXY_TARGET || "http://127.0.0.1:18080",
    },
  },
};

export default proxy;
