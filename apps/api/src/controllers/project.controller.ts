import { createProjectSchema, idParamSchema, patchProjectSchema, projectListQuerySchema, replaceProjectSchema } from '@pms/shared';
import type { Request, Response } from 'express';
import { requireUserId } from '../middleware/auth.middleware.js';
import { projectService } from '../services/project.service.js';
import { parse, sendData, sendNoContent, sendPage } from '../utils/http.js';

/** Controllers only translate HTTP ⇄ service calls: parse input, call the service, shape the response. */
export const projectController = {
  async list(req: Request, res: Response) {
    const { items, meta } = await projectService.list(requireUserId(req), parse(projectListQuerySchema, req.query));
    sendPage(res, items, meta);
  },

  async get(req: Request, res: Response) {
    const { id } = parse(idParamSchema, req.params);
    sendData(res, await projectService.get(requireUserId(req), id));
  },

  async create(req: Request, res: Response) {
    sendData(res, await projectService.create(requireUserId(req), parse(createProjectSchema, req.body)), 201);
  },

  async replace(req: Request, res: Response) {
    const { id } = parse(idParamSchema, req.params);
    sendData(res, await projectService.update(requireUserId(req), id, parse(replaceProjectSchema, req.body)));
  },

  async patch(req: Request, res: Response) {
    const { id } = parse(idParamSchema, req.params);
    sendData(res, await projectService.update(requireUserId(req), id, parse(patchProjectSchema, req.body)));
  },

  async remove(req: Request, res: Response) {
    const { id } = parse(idParamSchema, req.params);
    await projectService.remove(requireUserId(req), id);
    sendNoContent(res);
  },
};
