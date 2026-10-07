import { createTaskSchema, idParamSchema, patchTaskSchema, replaceTaskSchema, taskListQuerySchema } from '@pms/shared';
import type { Request, Response } from 'express';
import { requireUserId } from '../middleware/auth.middleware.js';
import { taskService } from '../services/task.service.js';
import { parse, sendData, sendNoContent, sendPage } from '../utils/http.js';

export const taskController = {
  async list(req: Request, res: Response) {
    const { items, meta } = await taskService.list(requireUserId(req), parse(taskListQuerySchema, req.query));
    sendPage(res, items, meta);
  },

  async get(req: Request, res: Response) {
    const { id } = parse(idParamSchema, req.params);
    sendData(res, await taskService.get(requireUserId(req), id));
  },

  async create(req: Request, res: Response) {
    sendData(res, await taskService.create(requireUserId(req), parse(createTaskSchema, req.body)), 201);
  },

  async replace(req: Request, res: Response) {
    const { id } = parse(idParamSchema, req.params);
    sendData(res, await taskService.update(requireUserId(req), id, parse(replaceTaskSchema, req.body)));
  },

  async patch(req: Request, res: Response) {
    const { id } = parse(idParamSchema, req.params);
    sendData(res, await taskService.update(requireUserId(req), id, parse(patchTaskSchema, req.body)));
  },

  async remove(req: Request, res: Response) {
    const { id } = parse(idParamSchema, req.params);
    await taskService.remove(requireUserId(req), id);
    sendNoContent(res);
  },
};
