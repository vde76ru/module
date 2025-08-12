module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Отключаем ESLint плагин
      webpackConfig.plugins = webpackConfig.plugins.filter(
        (plugin) => plugin.constructor.name !== 'ESLintWebpackPlugin'
      );

      // Настройки для webpack 5
      if (webpackConfig.resolve) {
        webpackConfig.resolve.fallback = {
          ...webpackConfig.resolve.fallback,
          fs: false,
          path: false,
          os: false,
        };
      }

      return webpackConfig;
    },
  },
  babel: {
    presets: [
      [
        '@babel/preset-env',
        {
          targets: {
            node: 'current',
          },
        },
      ],
      '@babel/preset-react',
    ],
  },
  devServer: {
    port: 3000,
    hot: true,
    open: true,
  },
};
