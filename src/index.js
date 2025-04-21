import dbConnect from "./database/dbConnect.js";
import dotenv from "dotenv";
import { app } from "./app.js";

dotenv.config({
  path: "./.env",
});

dbConnect()
  .then(() => {
    app.listen(process.env.PORT || 3000, () => {
      console.log(`App is running on Port :: ${process.env.PORT} `);
    });
  })
  .catch((error) => {
    console.log("MongoDB Connection Failed ::", error);
  });
