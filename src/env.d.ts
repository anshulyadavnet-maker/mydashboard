/// <reference types="astro/client" />

interface UserPayload {
  userId: number;
  email: string;
  name?: string;
}

declare namespace App {
  interface Locals {
    user?: UserPayload;
    runtime?: {
      env: {
        DB: import('@cloudflare/workers-types').D1Database;
        JWT_SECRET?: string;
      };
    };
  }
}
