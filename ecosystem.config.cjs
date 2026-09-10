module.exports = {
  apps: [
    {
      name: "trading-guru",
      script: "./server.js",
      cwd: "./backend",
      env: {
        NODE_ENV: "production",
        PORT: 3002
      },
      restart_delay: 3000,
      max_restarts: 10,
      autorestart: true
    }
  ]
};
