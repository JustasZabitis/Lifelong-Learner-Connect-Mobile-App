import { Pool } from "pg";

export const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "lifelong_learner_connect",
  password: "lifelong_learner_connect",
  port: 5432,
});