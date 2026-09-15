import { z } from "zod";

// What anything touching the database needs - the web app and the scripts
// (migrations, create-admin). Scripts import only this, so they do not require
// web-app secrets they never use. Web-app variables go in env.server.ts.
export const databaseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

export function parseEnv<Schema extends z.ZodType>(
  schema: Schema,
  source: NodeJS.ProcessEnv,
): z.infer<Schema> {
  const result = schema.safeParse(source);
  if (!result.success) {
    // Issue messages name the variable and the rule, never the value.
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export const databaseEnv = parseEnv(databaseEnvSchema, process.env);
