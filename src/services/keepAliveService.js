import cron from "node-cron";

class KeepAliveService {
  constructor() {
    this.isProduction = process.env.NODE_ENV === "production";
    this.serviceUrl =
      process.env.SERVICE_URL ||
      "https://voice-ai-generator-backend.onrender.com";
  }

  async pingService() {
    try {
      const response = await fetch(`${this.serviceUrl}/health`);
      const data = await response.json();
      console.log(
        `✅ Keep-alive ping successful at ${new Date().toISOString()}:`,
        data
      );
      return true;
    } catch (error) {
      console.error(
        `❌ Keep-alive ping failed at ${new Date().toISOString()}:`,
        error.message
      );
      return false;
    }
  }

  start() {
    if (!this.isProduction) {
      console.log("🔧 Keep-alive service disabled in development mode");
      return;
    }

    console.log(`🚀 Starting keep-alive service for ${this.serviceUrl}`);

    // Ping every 10 minutes to prevent Render from sleeping
    cron.schedule("*/10 * * * *", async () => {
      await this.pingService();
    });

    // Also ping every 5 minutes during peak hours (9 AM to 11 PM UTC)
    cron.schedule("*/5 9-23 * * *", async () => {
      await this.pingService();
    });

    // Initial ping
    setTimeout(() => {
      this.pingService();
    }, 5000); // Wait 5 seconds after startup
  }

  stop() {
    // Gracefully stop cron jobs if needed
    console.log("🛑 Keep-alive service stopped");
  }
}

export default KeepAliveService;
