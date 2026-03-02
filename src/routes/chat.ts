/**
 * Chat Completions 路由
 */
import { defineRoute, Type } from "vafast";
import { chatCompletions } from "../requests/chat_completions";

const chatBodySchema = {
  body: Type.Object({
    model: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    messages: Type.Optional(Type.Array(Type.Any())),
  }),
};

export const chatRoutes = [
  defineRoute({
    method: "POST",
    path: "/chat/completions",
    schema: chatBodySchema,
    handler: async ({ req, body }) => chatCompletions(req, body),
  }),
  defineRoute({
    method: "POST",
    path: "/v1/chat/completions",
    schema: chatBodySchema,
    handler: async ({ req, body }) => chatCompletions(req, body),
  }),
];
