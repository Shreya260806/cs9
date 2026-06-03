import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import dns from "dns";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Set custom DNS resolvers only when explicitly enabled — avoids overriding
// production DNS in environments where Atlas SRV resolution fails locally.
if (process.env.MONGODB_USE_CUSTOM_DNS === "true") {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch (e) {
    console.warn("Could not set custom DNS servers:", e.message);
  }
}

const getMongoUri = () =>
  process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;

const getFaqMongoUri = () => {
  if (process.env.MONGO_URI_FAQ) return process.env.MONGO_URI_FAQ;
  const mainUri = getMongoUri();
  if (!mainUri) return null;
  try {
    const url = new URL(mainUri);
    url.pathname = "/samagama-faqs";
    return url.toString();
  } catch (e) {
    if (mainUri.endsWith("/rogare")) {
      return mainUri.replace("/rogare", "/samagama-faqs");
    }
    return mainUri + "-faq";
  }
};

const mongoUri = getMongoUri();
const faqUri = getFaqMongoUri();

if (!mongoUri) {
  throw new Error(
    "MongoDB connection string is missing. Set MONGODB_URI in backend/.env."
  );
}

const isLocal = mongoUri.includes("127.0.0.1") || mongoUri.includes("localhost");
const useTls = process.env.MONGODB_TLS === "true" || (process.env.NODE_ENV === "production" && !isLocal);

const connectionOptions = {
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
};

if (useTls) {
  connectionOptions.tls = true;
  connectionOptions.tlsAllowInvalidCertificates = false;
  connectionOptions.tlsAllowInvalidHostnames = false;
}

const isTest =
  process.env.NODE_ENV === "test" ||
  process.execArgv.includes("--test") ||
  process.execArgv.includes("test") ||
  (process.argv[1] && (
    process.argv[1].endsWith(".test.js") ||
    process.argv[1].includes("/tests/") ||
    process.argv[1].includes("\\tests\\")
  ));

// Skip DB connections in test environments to prevent process hanging
if (isTest) {
  console.log("Test environment detected — skipping DB connections");
}

// Create the FAQ connection immediately (skip connection in test environments to prevent hanging)
export const faqConnection = isTest
  ? null
  : faqUri
    ? mongoose.createConnection(faqUri, connectionOptions)
    : null;

const connectDB = async () => {
  const conn = await mongoose.connect(mongoUri, {
    dbName: process.env.MONGODB_DB_NAME,
    ...connectionOptions,
  });
  console.log(`MongoDB connected: ${conn.connection.host}`);
  return conn;
};

export default connectDB;