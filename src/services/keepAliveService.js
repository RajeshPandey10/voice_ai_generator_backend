import cron from "node-cron";

class KeepAliveService {
  constructor() {
    this.serviceUrl =
      process.env.SERVICE_URL ||
      "https://voice-ai-generator-backend.onrender.com";
    this.healthEndpoint = `${this.serviceUrl}/health`;
    this.isRunning = false;
    this.scheduledTask = null;
  }

  async pingHealth() {
    try {
      const response = await fetch(this.healthEndpoint);
      const timestamp = new Date().toISOString();

      if (response.ok) {
        console.log(
          `✅ [${timestamp}] Keep-alive ping successful - Status: ${response.status}`
        );
      } else {
        console.warn(
          `⚠️ [${timestamp}] Keep-alive ping returned status: ${response.status}`
        );
      }
    } catch (error) {
      const timestamp = new Date().toISOString();
      console.error(`❌ [${timestamp}] Keep-alive ping failed:`, error.message);
    }
  }

  start() {
    if (this.isRunning) {
      console.log("🔄 Keep-alive service is already running");
      return;
    }

    // Schedule to run every 10 minutes
    this.scheduledTask = cron.schedule("*/10 * * * *", async () => {
      await this.pingHealth();
    });

    // Also schedule more frequent pings during peak hours (9 AM to 9 PM UTC)
    cron.schedule("*/5 9-21 * * *", async () => {
      await this.pingHealth();
    });

    this.isRunning = true;
    console.log("🚀 Keep-alive service started");
    console.log(`📡 Monitoring: ${this.healthEndpoint}`);
    console.log(
      "⏰ Schedule: Every 10 minutes (every 5 minutes during peak hours 9-21 UTC)"
    );

    // Initial ping
    this.pingHealth();
  }

  stop() {
    if (this.scheduledTask) {
      this.scheduledTask.destroy();
      this.scheduledTask = null;
    }
    this.isRunning = false;
    console.log("🛑 Keep-alive service stopped");
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      serviceUrl: this.serviceUrl,
      healthEndpoint: this.healthEndpoint,
    };
  }
}

// Create a singleton instance
const keepAliveService = new KeepAliveService();

export default keepAliveService;
