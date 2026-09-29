import { betterAuth } from "better-auth";
import { pool } from "./db.js";

export const auth = betterAuth({
  database: pool,
  emailAndPassword: { enabled: true },
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  // Web preview (:8090), dev server (:8081/:8082), LAN phone URL
  trustedOrigins: (process.env.TRUSTED_ORIGINS ||
    "http://localhost:8090,http://127.0.0.1:8090,http://localhost:8081,http://localhost:8082,http://127.0.0.1:8081,http://127.0.0.1:8082,exp://192.168.185.121:8081,http://192.168.185.121:8081"
  ).split(","),
});
