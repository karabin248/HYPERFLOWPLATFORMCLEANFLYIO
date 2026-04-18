import { Router, type IRouter } from "express";
import healthRouter from "./health";
import metricsRouter from "./metrics";
import agentsRouter from "./agents";
import agentRunsRouter from "./agentRuns";
import { requireAuth } from "../middlewares/auth";
import { rateLimiter } from "../middlewares/rateLimiter";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requireAuth);
router.use(metricsRouter);

router.post("/agents/run", rateLimiter("run"));
router.post("/agent-runs/:id/retry", rateLimiter("run"));

router.use(agentsRouter);
router.use(agentRunsRouter);

export default router;
