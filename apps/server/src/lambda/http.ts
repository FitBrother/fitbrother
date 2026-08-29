import awsLambdaFastify from "@fastify/aws-lambda";
import * as SentryServerless from "@sentry/aws-serverless";
import { buildApp } from "../app.js";
import { initSentry } from "../lib/sentry.js";

initSentry();

const appPromise = buildApp();
const proxyPromise = appPromise.then((app) => awsLambdaFastify(app));

export const handler = SentryServerless.wrapHandler(async (event: unknown, context: unknown) => {
  const proxy = await proxyPromise;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return proxy(event as any, context as any);
});
