import dbConnect from "./database/dbConnect.js";
import dotenv from "dotenv";

dotenv.config({
  path: "./env",
});

dbConnect();
