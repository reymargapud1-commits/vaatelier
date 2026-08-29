import "dotenv/config";
import { seedDatabase } from "./seed-logic";

seedDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
