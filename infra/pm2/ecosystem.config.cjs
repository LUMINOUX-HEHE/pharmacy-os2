module.exports = {
  apps: [
    {
      name: "pharmacy-os-api",
      cwd: "./apps/api",
      script: "dist/src/server.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
